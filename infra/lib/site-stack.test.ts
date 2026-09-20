import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { SiteStack, type SiteStackProps } from './site-stack'

function synth(overrides: Partial<SiteStackProps> = {}): Template {
  const app = new App()
  const stack = new SiteStack(app, 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
    siteDomain: 'example.dev',
    githubRepo: 'RainyForest23/rainyforest-web',
    budgetEmail: 'alerts@example.dev',
    ...overrides,
  })
  return Template.fromStack(stack)
}

const template = synth()

describe('SiteStack', () => {
  it('blocks all public access to the bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
  })

  it('lets only CloudFront read the bucket, through OAC', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1)
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
          }),
        ]),
      },
    })
  })

  it('issues one DNS-validated certificate for apex and www', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'example.dev',
      SubjectAlternativeNames: ['www.example.dev'],
      ValidationMethod: 'DNS',
    })
  })

  it('serves apex and www over TLS 1.2+ and redirects http to https', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['example.dev', 'www.example.dev'],
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
          SslSupportMethod: 'sni-only',
        }),
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 404, ResponsePagePath: '/404.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 404, ResponsePagePath: '/404.html' }),
        ]),
      }),
    })
  })

  it('runs the viewer-request function on JS 2.0 with the redirect store attached', () => {
    template.resourceCountIs('AWS::CloudFront::KeyValueStore', 1)
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: Match.objectLike({
        Runtime: 'cloudfront-js-2.0',
        KeyValueStoreAssociations: [Match.objectLike({ KeyValueStoreARN: Match.anyValue() })],
      }),
    })
  })

  it('lets GitHub Actions assume the deploy role only from main of this repo', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub':
                  'repo:RainyForest23/rainyforest-web:ref:refs/heads/main',
              },
            },
          }),
        ],
      },
    })
  })

  it('creates the GitHub OIDC provider, or reuses an existing one', () => {
    template.resourceCountIs('AWS::IAM::OIDCProvider', 1)
    const reused = synth({
      existingOidcProviderArn:
        'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
    })
    reused.resourceCountIs('AWS::IAM::OIDCProvider', 0)
  })

  it('alerts by email when monthly cost passes $5', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: 5, Unit: 'USD' },
      }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'alerts@example.dev' }],
        }),
      ]),
    })
  })

  it('contains no Lambda functions, including hidden custom resources', () => {
    template.resourceCountIs('AWS::Lambda::Function', 0)
  })

  it('exports the values the deploy workflow needs', () => {
    const outputs = Object.keys(template.toJSON().Outputs ?? {})
    expect(outputs).toEqual(
      expect.arrayContaining([
        'BucketName',
        'DistributionId',
        'DistributionDomainName',
        'RedirectsKvsArn',
        'DeployRoleArn',
      ]),
    )
  })
})
