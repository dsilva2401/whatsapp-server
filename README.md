# WhatsApp Server

Based on `@open-wa/wa-automate` module, exposes endpoints to create multiple WhatsApp sessions

## Services

#### Register a WhatsApp number session: `POST => /session`

Creates a WhatsApp session for an specific number

```js
// Body
{
  "phoneNumber": "xxxxxxxxx", // phone
  "onMessageWebhook": { // Optional
    "method": "[WEBHOOK_METHOD]",
    "url": "[WEBHOOK_URL]"
  }
}
```

#### Remove WhatsApp number session: `DELETE => /session/:phone`

Removes a WhatsApp session


#### Send a message: `POST => /session/:phone/send-message`

Send a WhatsApp message 

```js
// Body
{
	"type": "text",
  "to": "51912312312@c.us", // chat id (number@c.us for users code@g.us for groups)
  "content": "Hello World" 
}
```
