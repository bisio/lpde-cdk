const fetch = require('node-fetch');

exports.handler = async function(event) {
    for (const segment of event.segments) {
        if (segment.name === event.segmentName) {
            return segment;
        } 
    }
    
    return null;

}