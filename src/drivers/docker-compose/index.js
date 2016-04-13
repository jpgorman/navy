/* @flow */

import type {Driver} from '../../driver'
import {createComposeClient} from './client'
import {Environment} from '../../environment'
import {execAsync} from '../../util/exec-async'
import {Status as ServiceStatus} from '../../service'

import type {ServiceList} from '../../service'

function getArgsFromOptions(opts: Object, argMap: Object): Array<string> {
  return Object.keys(opts)
    .map(key => argMap[key])
    .filter(arg => !arg)
}

const launchArgMap = {
  noDeps: '--no-deps',
  forceRecreate: '--force-recreate',
}

export default function createDockerComposeDriver(environment: Environment): Driver {
  const {
    exec,
  } = createComposeClient(environment)

  return {
    async launch(services: Array<string>, opts: ?Object = {}): Promise<void> {
      const additionalArgs = []

      if (opts) {
        additionalArgs.push(...getArgsFromOptions(opts, launchArgMap))
      }

      await exec('up', ['-d', ...additionalArgs])
    },

    async destroy(): Promise<void> {
      await exec('kill')
      await exec('down', ['-v'])
    },

    async ps(): Promise<ServiceList> {
      const ids = (await exec('ps', ['-q'])).trim().split('\n')
      const inspectRaw = await execAsync('docker', ['inspect', ...ids])
      const inspectResult = JSON.parse(inspectRaw)

      return inspectResult.map(service => ({
        name: service.Config.Labels['com.docker.compose.service'],
        status: service.State.Running === true ? ServiceStatus.RUNNING : ServiceStatus.EXITED,
        raw: service,
      }))
    },

    async start(services: ?Array<string>): Promise<void> {
      await exec('start', services)
    },

    async stop(services: ?Array<string>): Promise<void> {
      await exec('stop', services)
    },

    async port(service: string, privatePort: number, index: ?number): Promise {
      if (index == null) index = 1

      const output = await exec('port', [service, privatePort, '--index=' + index])

      const port = output.substring(output.lastIndexOf(':') + 1).trim()

      if (port === '') {
        return null
      }

      return Number(port)
    },
  }
}
