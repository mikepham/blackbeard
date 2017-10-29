import { IRCParserOptions, IRCParserSecrets } from './IRCEntry'
import { Logger, ObjectNavigator } from '../../core'

export class IRCParser {
  private readonly log: Logger
  private readonly options: IRCParserOptions

  constructor(logger: Logger, options: IRCParserOptions) {
    this.log = logger.extend('irc-parser')
    this.options = options
  }

  public parse(text: string): IRCParserRecord {
    this.log.trace('parsing', text)
    const regex = new RegExp(this.options.filtering.pattern, 'g')
    let matches = regex.exec(text)
    const values: string[] = []
    while (matches) {
      values.push(matches[1] || '')
      matches = regex.exec(text)
    }

    this.log.traceJSON(matches)

    const record: IRCParserRecordMap = {}
    values.forEach((value: string, index: number) => {
      const property = this.options.filtering.properties[index]
      const formatter = this.options.formatters[property]
      record[property] = value
      if (formatter) {
        const replaced = value.replace(formatter.regex, formatter.replace)
        const formatted = this.format(replaced, this.options.secrets)
        record[property] = formatted
      }
    })

    this.log.traceJSON(record)
    return record as IRCParserRecord
  }

  private format(value: string, secrets: IRCParserSecrets): string {
    return Object.keys(secrets)
      .reduce((_, name: string): string => {
        const regex = new RegExp(`{${name}}`, 'gm')
        const secret = secrets[name]
        if (secret.toLowerCase().startsWith('env.')) {
          const key = secret.substring(1)
          return value = value.replace(regex, process.env[key.toUpperCase()] || value)
        }
        return value = value.replace(regex, secret)
      })
  }
}

export interface IRCParserRecord extends IRCParserRecordMap {
  category: string
  title: string
  url: string
}

export interface IRCParserRecordMap {
  [key: string]: string
}
