const fetch = require('node-fetch');
const AWS = require('aws-sdk');

exports.handler = async function(event) {

    if (event.httpMethod != 'POST') {
        return {
            statusCode: 400,
            body: 'Unsupported method'
        }
    }
    let listId = process.env.MAIL_CHIMP_LIST_ID;
    let apiKey = process.env.MAIL_CHIMP_KEY;
    let host   = 'us8.api.mailchimp.com';


    let body = JSON.parse(event.body);
    let segmentId = body.segmentId;


    let path   = `/3.0/lists/${listId}/segments/${segmentId}/members`;
    
    const res = await fetch(`https://${host}/${path}`, {
        headers: {
            'Authorization': `apikey ${apiKey}`
        }
    });

    const json = await res.json();

    let sqs = new AWS.SQS({apiVersion: '2012-11-05'});

    const queueUrlRes = await sqs.getQueueUrl({
        QueueName: process.env.QUEUE_NAME
    }).promise();

    console.log(json.members);

    for (const el of json.members){
        await sqs.sendMessage({
            MessageBody: JSON.stringify({
                "id": el.id,
                "email_addresss": el.email_address,
                "merge_fields": el.merge_fields,
                "templatePath": body.templatePath,
                "destinationPath": body.destinationPath
            }),
            QueueUrl: queueUrlRes.QueueUrl
        }).promise();        
    }

    return {
        statusCode: 200,
        body: 'Done'
    }; 
}