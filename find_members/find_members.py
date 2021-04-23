import json
import boto3
import uuid

def lambda_handler(event, context):
    client = boto3.client('stepfunctions')

    if event.get("httpMethod"):
        segmentName = event.get('pathParameters').get('segmentName')
        print(event)
    else:
        segmentName = event['segmentName']
        
    #INPUT -> { "segmentName": "staff"  }
    payload = { 'segmentName': segmentName }
    executionId = str(uuid.uuid1())    

    response = client.start_sync_execution(
            stateMachineArn = 'arn:aws:states:eu-south-1:328697909738:stateMachine:FindMembersOrch-1',
            name = executionId,
            input=json.dumps(payload))

    print(response)

    return {
        'statusCode': 200,
        'body': response["output"]
    }
