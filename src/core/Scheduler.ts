import 'reflect-metadata'

import * as schedule from 'node-schedule'
import { injectable } from 'inversify'
import { Config } from './Config'
import { FileSystem } from './FileSystem'
import { Logger } from './Logger'
import { LoggerFactory } from './LoggerFactory'
import { Script } from './Script'
import { ScriptFactory } from './ScriptFactory'

interface JobConfig {
  schedule: schedule.RecurrenceRule | schedule.RecurrenceSpecDateRange | schedule.RecurrenceSpecObjLit
  script: string
}

@injectable()
export class Scheduler {
  private readonly config: Config
  private readonly log: Logger
  private readonly scripts: Script[]

  constructor(config: Config, logger: LoggerFactory, scripts: ScriptFactory) {
    this.config = config
    this.log = logger.create('service:scheduler')
    this.scripts = scripts.get()
  }

  public async start(filename: string): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const config = await this.config.load<JobConfig[]>(filename)
        const jobs = config.map((config: JobConfig) => this.job(config))
        this.log.info(`${jobs.length} job(s) scheduled`)
        process.on('beforeExit', () => jobs.forEach(job => job.cancel()))
        await Promise.all(jobs)
        resolve()
      } catch (error) {
        reject(error)
        throw error
      }
    })
  }

  private job(config: JobConfig): schedule.Job {
    this.log.trace(`creating job to run script ${config.script}`)
    this.log.traceJSON(config.schedule)

    return schedule.scheduleJob(`job:${config.script}`, config.schedule, (): void => {
      const scripts = this.scripts
        .filter(script => script.name === config.script)
        .map(script => script.start())

      Promise.all(scripts).catch(error => this.log.error(error))
    })
  }
}
