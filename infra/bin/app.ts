import { App } from 'aws-cdk-lib'
import { SiteStack } from '../lib/site-stack'

const app = new App()

const siteDomain: string | undefined = app.node.tryGetContext('siteDomain')
if (!siteDomain) throw new Error('Set "siteDomain" in cdk.json context (see README: first deploy).')

const budgetEmail = process.env.BUDGET_EMAIL
if (!budgetEmail) throw new Error('Set BUDGET_EMAIL in the environment when running cdk.')

new SiteStack(app, 'RainyforestWeb', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  siteDomain,
  githubRepo: 'RainyForest23/rainyforest-web',
  budgetEmail,
  existingOidcProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
})
