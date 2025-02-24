import { XMLParser } from 'fast-xml-parser'

const LOVE_SYMBOLS = [
	'\u2764\uFE0F', // :heart:
	'\uD83D\uDC96', // :sparkling_heart:
	'\uD83E\uDD70', // :smiling_face_with_3_hearts:
	'\uD83D\uDC93', // :heartbeat:
	'\uD83D\uDC9D', // :heart_with_ribbon:
	'\uD83D\uDE0D', // :heart_eyes:
	'\uD83D\uDE18', // :kissing_heart:
]

const [filename, type] = process.argv.slice(2)
const xml = await parse()
const messages = analyze(xml)

if (type === '--json') {
	console.log(JSON.stringify(messages, null, 2))
} else {
	report(messages)
}

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

function report(allMessages: Message[]) {
	const messages = allMessages.filter((x) => x.type === 'message')
	const myMessages = messages.filter((x) => x.sender === 'me')
	const theirMessages = messages.filter((x) => x.sender === 'them')

	const reactions = allMessages.filter((x) => x.type === 'reaction')
	const myReactions = reactions.filter((x) => x.sender === 'me')
	const theirReactions = reactions.filter((x) => x.sender === 'them')

	const love = countLove(allMessages)
	const myLove = countLove(allMessages.filter((x) => x.sender === 'me'))
	const theirLove = countLove(allMessages.filter((x) => x.sender === 'them'))

	console.log(` Total messages: ${messages.length}`)
	console.log(`    My messages: ${myMessages.length}`)
	console.log(` Their messages: ${theirMessages.length}`)

	console.log(`Total reactions: ${reactions.length}`)
	console.log(`   My reactions: ${myReactions.length}`)
	console.log(`Their reactions: ${theirReactions.length}`)

	console.log(`     Total love: ${love}`)
	console.log(`        My love: ${myLove}`)
	console.log(`     Their love: ${theirLove}`)
}

function countLove(messages: Message[]) {
	return messages.reduce(
		(count, x) =>
			count +
			LOVE_SYMBOLS.reduce((sum, s) => sum + (x.body.split(s).length - 1), 0),
		0,
	)
}
