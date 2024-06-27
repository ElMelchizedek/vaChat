// Triggered when a new record appears in a channel's stream, causing it to send it to the corresponding SNS topic to be read by subscribed clients.

exports.handler = (event, context) => {
	console.log(JSON.stringify(event));
}