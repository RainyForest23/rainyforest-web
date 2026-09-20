import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

export interface SiteStackProps extends StackProps {
  /** Apex domain, e.g. "example.dev". www is served and redirected to it. */
  siteDomain: string
  /** "owner/name" of the repository allowed to deploy. */
  githubRepo: string
  /** Receives budget alerts. Injected at deploy time; never committed. */
  budgetEmail: string
  /** The GitHub OIDC provider is one per account; pass its ARN if it already exists. */
  existingOidcProviderArn?: string
}

const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com'

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props)
    const { siteDomain, githubRepo, budgetEmail } = props
    const wwwDomain = `www.${siteDomain}`

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: siteDomain,
      subjectAlternativeNames: [wwwDomain],
      validation: acm.CertificateValidation.fromDns(),
    })

    const redirects = new cloudfront.KeyValueStore(this, 'Redirects')

    const viewerRequest = new cloudfront.Function(this, 'ViewerRequest', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromFile({
        filePath: fileURLToPath(new URL('../functions/viewer-request.js', import.meta.url)),
      }),
      keyValueStore: redirects,
    })

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [siteDomain, wwwDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: viewerRequest, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      // Without s3:ListBucket, S3 answers 403 for missing keys; show the 404 page for both.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: Duration.minutes(5),
      })),
    })

    const oidcProviderArn =
      props.existingOidcProviderArn ??
      new iam.CfnOIDCProvider(this, 'GithubOidcProvider', {
        url: `https://${GITHUB_OIDC_HOST}`,
        clientIdList: ['sts.amazonaws.com'],
      }).attrArn

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      description: `Content deploys from ${githubRepo}@main`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(
        oidcProviderArn,
        {
          StringEquals: {
            [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com',
            [`${GITHUB_OIDC_HOST}:sub`]: `repo:${githubRepo}:ref:refs/heads/main`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    })
    bucket.grantReadWrite(deployRole)
    bucket.grantDelete(deployRole)
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [distribution.distributionArn],
      }),
    )
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudfront-keyvaluestore:DescribeKeyValueStore',
          'cloudfront-keyvaluestore:ListKeys',
          'cloudfront-keyvaluestore:UpdateKeys',
        ],
        resources: [redirects.keyValueStoreArn],
      }),
    )

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'rainyforest-web-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 5, unit: 'USD' },
      },
      notificationsWithSubscribers: (['ACTUAL', 'FORECASTED'] as const).map((notificationType) => ({
        notification: {
          notificationType,
          comparisonOperator: 'GREATER_THAN',
          threshold: 100,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: budgetEmail }],
      })),
    })

    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName })
    new CfnOutput(this, 'RedirectsKvsArn', { value: redirects.keyValueStoreArn })
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn })
  }
}
