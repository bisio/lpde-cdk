const fetch = require('node-fetch');

exports.handler = async function(event) {
    console.log(event);
    let listId = process.env.MAIL_CHIMP_LIST_ID;
    let host   = 'us8.api.mailchimp.com';
    let path   = `/3.0/lists/${listId}/segments/`;
 
    
    let apiKey = process.env.MAIL_CHIMP_KEY;

    const res = await fetch(`https://${host}/${path}`, {
        headers: {
            'Authorization': `apikey ${apiKey}`
        }
    });

    const json = await res.json();
    
    let segments = json.segments.map(el => { 
        return {
            "id": el.id,
            "name": el.name,
            "member_count":el.member_count
        }
    });

    return {
        statusCode: 200,
        body: JSON.stringify({segments: segments})
    } 
}