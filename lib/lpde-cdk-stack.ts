import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as ssm from '@aws-cdk/aws-ssm';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';


export class LpdeCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const templateBucket = new s3.Bucket(this, 'templateBucket');
    templateBucket.policy?.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    const publicDocumentsBucket = new s3.Bucket(this, 'publicDocumentsBucket');
    publicDocumentsBucket.policy?.applyRemovalPolicy(RemovalPolicy.DESTROY);

    publicDocumentsBucket.grantPublicAccess();

    new BucketDeployment(this, 'templateDeployment', {
      sources: [ Source.asset('./templates')],
      destinationBucket: templateBucket
    });


    const mailChimpKey = ssm.StringParameter.fromStringParameterAttributes(this, 'MailChimpKey', {
      parameterName: '/mailchimp/ApiKey',
      version: 2,
    }).stringValue;

    const mailChimpListId = ssm.StringParameter.fromStringParameterAttributes(this, 'mailChimpListId', {
      parameterName: '/mailchimp/ListId',
      version: 1,
    }).stringValue;

    const cloudMersiveKey = ssm.StringParameter.fromStringParameterAttributes(this, 'ColudMersiveKey', {
      parameterName: '/cloudmersive/ApiKey',
      version: 1
    }).stringValue;

    const mailchimpSegments = new lambda.Function(this, 'MailChimpSegmentsHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'mailchimp-segments.handler',
      timeout: Duration.seconds(3),
      environment: {
        MAIL_CHIMP_KEY: mailChimpKey,
        MAIL_CHIMP_LIST_ID: mailChimpListId
      }
    });

    const documentQueue = new sqs.Queue(this, 'DocumentQueue');

    const mailChimpMerge = new lambda.Function(this, 'MailChimpMergeHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'mailchimp-merge.handler',
      timeout: Duration.seconds(3),
      environment: {
        QUEUE_NAME: documentQueue.queueName,
        MAIL_CHIMP_KEY: mailChimpKey,
        MAIL_CHIMP_LIST_ID: mailChimpListId
      }
    });

    const mailChimpProcessDocument = new lambda.Function(this, 'MailChimpDocHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'mailchimp-doc.handler',
      timeout: Duration.seconds(30),
      environment: {
        TEMPLATES_BUCKET_NAME: templateBucket.bucketName,
        OUTPUT_BUCKET_NAME: publicDocumentsBucket.bucketName,
        CLOUDMERSIVE_API_KEY: cloudMersiveKey
      }
    });

    documentQueue.grantSendMessages(mailChimpMerge);

    templateBucket.grantReadWrite(mailChimpProcessDocument);
    publicDocumentsBucket.grantReadWrite(mailChimpProcessDocument);

    mailChimpProcessDocument.addEventSource(new SqsEventSource(documentQueue, {
      batchSize: 2
    }));

    new apigw.LambdaRestApi(this, 'MailChimpSegmentsHandlerEndpoint', {
      handler: mailchimpSegments
    });

    new apigw.LambdaRestApi(this, 'MailChimpMergeHandlerEndpoint', {
      handler: mailChimpMerge
    });

  }
}
