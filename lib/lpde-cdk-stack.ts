import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as ssm from '@aws-cdk/aws-ssm';
import * as sfn from '@aws-cdk/aws-stepfunctions';
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

    const mailchimpMembers = new lambda.Function(this, 'MailChimpMembersHanlder', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'mailchimp-list-members.handler',
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

    const mailChimpFindMembers = new lambda.Function(this, 'MailChimpFindMembersHandler',{
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset('find_members'),
      handler: 'find_members.lambda_handler',
      timeout: Duration.seconds(10)
    });

    const searchForName = new lambda.Function(this, 'SearchForNameHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'search-for-name.handler',
      timeout: Duration.seconds(3),
    })

    documentQueue.grantSendMessages(mailChimpMerge);

    templateBucket.grantReadWrite(mailChimpProcessDocument);
    publicDocumentsBucket.grantReadWrite(mailChimpProcessDocument);

    mailChimpProcessDocument.addEventSource(new SqsEventSource(documentQueue, {
      batchSize: 2
    }));

    const mailchimpApi =  new apigw.RestApi(this, 'mailchimp-api');
    
    const segments = mailchimpApi.root.addResource('segments');
    segments.addMethod('GET', new apigw.LambdaIntegration(mailchimpSegments));
    const segment = segments.addResource('{segment_id}');
    const members = segment.addResource('members');
    members.addMethod('GET', new apigw.LambdaIntegration(mailchimpMembers));      

    const by_name =  segments.addResource("by_name");
    const segmentName = by_name.addResource('{segmentName}');
    const membersBySegmentName = segmentName.addResource('members');

    membersBySegmentName.addMethod('GET', new apigw.LambdaIntegration(mailChimpFindMembers));

    const findMembersOrch1 = sfn.StateMachine.fromStateMachineArn(
      this,
      'FinMembersOrch1',
      'arn:aws:states:eu-south-1:328697909738:stateMachine:FindMembersOrch-1'
    );    
    findMembersOrch1.grantExecution(mailChimpFindMembers,"states:StartSyncExecution");
    mailChimpFindMembers.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [findMembersOrch1.stateMachineArn],
      actions: ['states:StartSyncExecution']
    }))
  }
}
