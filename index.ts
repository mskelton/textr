import { XMLParser } from 'fast-xml-parser'

const [filename] = process.argv.slice(2)
const xml = await parse()
const results = analyze(xml)

console.log(JSON.stringify(results, null, 2))

async function parse() {
	const file = await Bun.file(filename).text()
	const parser = new XMLParser({
		attributeNamePrefix: '@',
		ignoreAttributes: false,
	})

	return parser.parse(file)
}

function analyze(xml: any) {
	const messages: Message[] = []

	function process(sender: string, body: string, timestamp: number) {
		const cleaned = cleanBody(body)
		const match = cleaned.match(/\u200b?(.*?)\u200b+ to “/)

		if (match) {
			messages.push({
				type: 'reaction',
				timestamp: timestamp,
				sender: sender,
				body: match[1],
			})
		} else {
			messages.push({
				type: 'message',
				timestamp: timestamp,
				sender: sender,
				body: cleaned,
			})
		}
	}

	for (const sms of xml.smses.sms) {
		process(sms['@type'] === '1' ? 'them' : 'me', sms['@body'], sms['@date'])
	}

	for (const mms of xml.smses.mms) {
		const text = toArray(mms.parts.part).find(
			(part) => part['@ct'] === 'text/plain',
		)

		if (!text) {
			continue
		}

		process(
			mms['@m_type'] === '128' ? 'me' : 'them',
			text['@text'],
			parseInt(mms['@date']),
		)
	}

	return messages.toSorted((a, b) => a.timestamp - b.timestamp)
}

function cleanBody(body: string) {
	return body.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(code))
}

function toArray<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value]
}

type Message = {
	type: 'message' | 'reaction'
	timestamp: number
	sender: string
	body: string
}
