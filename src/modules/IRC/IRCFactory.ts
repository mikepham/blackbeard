import 'reflect-metadata'

import { Api, IRCInterfaces, IRCRPC, IRCClientOptions, IRCMessage, IRCOptions } from 'irc-factory'
import { injectable } from 'inversify'
import { Config, Converters, Logger, LoggerFactory, Variables } from '../../core'
import { DataMessage } from './DataMessage'
import { IRCEntries, IRCEntry } from './IRCEntry'
import { IRCFactoryClient, InternalIRCFactoryClient } from './IRCFactoryClient'

interface IRCFactoryClients {
  [key: string]: IRCFactoryClient
}

type IRCFactoryHandler = (name: string, entry: IRCEntry, interfaces: IRCInterfaces) => void

interface IRCFactoryHandlers {
  [key: string]: IRCFactoryHandler
}

@injectable()
export class IRCFactory {
  private readonly clients: IRCFactoryClients
  private readonly config: Config
  private readonly handlers: IRCFactoryHandlers
  private readonly log: Logger
  private readonly vars: Variables

  constructor(config: Config, logger: LoggerFactory, vars: Variables) {
    this.clients = {}
    this.config = config
    this.handlers = {}
    this.log = logger.create('irc-factory')
    this.vars = vars

    this.handlers.synchronize = this.synchronize
  }

  public start(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const api = new Api()
      const config = await this.config.load<IRCEntries>('nas-ircfactory.json')

      Object.keys(config).forEach(key => {
        const entry = config[key]
        const interfaces = api.connect(entry.api)
        interfaces.events.on('message', (data: DataMessage): void => this.process(data, key, entry, interfaces))
      })

      process.on('beforeExit', () => Object.keys(this.clients)
        .map(key => this.clients[key])
        .forEach(client => client.destroy())
      )
    })
  }

  private process(data: DataMessage, key: string, entry: IRCEntry, interfaces: IRCInterfaces): void {
    try {
      if (data.event instanceof Array) {
        const clientId = data.event[0]
        const event = data.event[1]
        const client = this.clients[key]
        if (clientId === client.id) {
          client.process(event, data)
        }
        return
      }

      const event = data.event as string
      if (this.handlers[event]) {
        const handler = this.handlers[event]
        handler(key, entry, interfaces)
      } else {
        this.log.trace(`unconsumed event: ${event}`)
      }
    } catch (error) {
      this.log.traceJSON(data)
      this.log.error(error)
    }
  }

  private synchronize = (name: string, entry: IRCEntry, interfaces: IRCInterfaces): void => {
    this.log.trace(`synchronize: ${name}`)
    this.clients[name] = new InternalIRCFactoryClient(name, entry, interfaces, this.log)
  }
}
