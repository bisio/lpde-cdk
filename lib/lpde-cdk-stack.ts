import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as sqs from '@aws-cdk/aws-sqs';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as logs  from '@aws-cdk/aws-logs';


export class LpdeCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mailChimpKey = ssm.StringParameter.fromStringParameterAttributes(this, 'MailChimpKey', {
      parameterName: '/mailchimp/ApiKey',
      version: 1,
    }).stringValue;

    const mailChimpListId = ssm.StringParameter.fromStringParameterAttributes(this, 'mailChimpListId', {
      parameterName: '/mailchimp/ListId',
      version: 1,
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

    const searchForName = new lambda.Function(this, 'SearchForNameHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'search-for-name.handler',
      timeout: Duration.seconds(3),
    })


    const listSegmentsStage =  new tasks.LambdaInvoke(this, 'ListSegmentsStage', {
      lambdaFunction: mailchimpSegments,
      payloadResponseOnly: true,
      resultPath: '$.segments' 
    });

    const searchForNameStage = new tasks.LambdaInvoke(this, 'SearchForNameStage', {
      lambdaFunction: searchForName,
      payloadResponseOnly: true,
      resultPath: '$.choosenSegment'
    });

    const getMembersStage = new tasks.LambdaInvoke(this, 'GetMembersStage',{
      lambdaFunction: mailchimpMembers,
      payloadResponseOnly: true,
      inputPath: '$.choosenSegment'
    });

    const definition = listSegmentsStage
                      .next(searchForNameStage)
                      .next(getMembersStage);
    

    const logGroup = new logs.LogGroup(this, 'FindMembersOrchLogGroup');

    const findMembersOrch = new sfn.StateMachine(this, 'findMembersOrch', {
       stateMachineType: sfn.StateMachineType.EXPRESS,
       definition: definition,
       logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      }
    });


    const mailChimpFindMembers = new lambda.Function(this, 'MailChimpFindMembersHandler',{
      runtime: lambda.Runtime.PYTHON_3_7,
      code: lambda.Code.fromAsset('find_members'),
      handler: 'find_members.lambda_handler',
      timeout: Duration.seconds(10),
      environment: {
        STATE_MACHINE_ARN: findMembersOrch.stateMachineArn
      }
    });

    mailChimpFindMembers.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [findMembersOrch.stateMachineArn],
      actions: ['states:StartSyncExecution']
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

  }
}
