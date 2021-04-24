import json
import boto3
import uuid
import os

def lambda_handler(event, context):
    client = boto3.client('stepfunctions')

    if event.get("httpMethod"):
        segmentName = event.get('pathParameters').get('segmentName')
        print(event)
    else:
        segmentName = event['segmentName']

    payload = { 'segmentName': segmentName }
    executionId = str(uuid.uuid1())    

    response = client.start_sync_execution(
            stateMachineArn = os.environ['STATE_MACHINE_ARN'],
            name = executionId,
            input=json.dumps(payload))

    print(response)

    return {
        'statusCode': 200,
        'body': response["output"]
    }
