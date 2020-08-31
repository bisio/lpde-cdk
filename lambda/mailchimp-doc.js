const AWS = require('aws-sdk');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const s3 = new AWS.S3();
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');
const Promise = require('bluebird');

exports.handler = async function(event) {


    for (const record of event.Records) {

        let body = JSON.parse(record.body);

        let params = {
            Bucket: process.env.TEMPLATES_BUCKET_NAME,
            Key: body.templatePath
        };

        let template = await s3.getObject(params).promise();

        let zip = new PizZip(template.Body);
        let doc = new Docxtemplater(zip);

        doc.setData({
            FirstName: body.merge_fields.FNAME , 
            LastName: body.merge_fields.LNAME
        })

        doc.render();

        const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');


        let defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;

        let ApiKey = defaultClient.authentications['Apikey'];
        ApiKey.apiKey = process.env.CLOUDMERSIVE_API_KEY;

        console.log("HERE");

        let apiInstance = new CloudmersiveConvertApiClient.ConvertDocumentApi();

        console.log(apiInstance);

        let convertDocumentDocxToPdf = Promise.promisify(apiInstance.convertDocumentDocxToPdf, {context: apiInstance});

        let inputFile = doc.getZip().generate({
            type: 'nodebuffer'
        });

        let pdf = await convertDocumentDocxToPdf(inputFile);
        
        console.log(pdf);

        await s3.putObject({
            Bucket: process.env.OUTPUT_BUCKET_NAME,
            Key: body.destinationPath + '/' + body.id + ".pdf",
            Body: pdf
        }).promise();

    }

}