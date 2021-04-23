const fetch = require('node-fetch');
const AWS = require('aws-sdk');

exports.handler = async function(event) {
   console.log(event);
   let listId = process.env.MAIL_CHIMP_LIST_ID;
   let apiKey = process.env.MAIL_CHIMP_KEY;
   let host   = 'us8.api.mailchimp.com';

   let segmentId = null;

    if (event.httpMethod) {
    if (event.httpMethod != 'GET') {
        return {
            statusCode: 400,
            body: 'Unsupported method'
        }
    }
        segmentId = event.pathParameters.segment_id;
    } else {
        segmentId = event.id;
    }

    let path   = `/3.0/lists/${listId}/segments/${segmentId}/members`;
    
    const res = await fetch(`https://${host}/${path}`, {
        headers: {
            'Authorization': `apikey ${apiKey}`
        }
    });

    const json = await res.json();

    let members = json.members.map(el => { 
        return {
            "id": el.id,
            "unique_email_id": el.unique_email_id
        }
    });

    if (event.httpMethod) {
    return {
        statusCode: 200,
        body: JSON.stringify({members: members})
    } } else {
        return { "members":  members };
    }
     
}
