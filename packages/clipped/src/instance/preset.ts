import {spawn, spawnSync} from 'child_process'
import {isString, isFunction, isPlainObject} from 'lodash'
import yeoman from 'yeoman-environment'
import {createChainable} from 'jointed'

import {Clipped} from '.'

declare module '.' {
  interface Clipped {
    prototype: any; // eslint-disable-line no-undef, typescript/no-use-before-define
    __initialized__: boolean; // eslint-disable-line no-undef, typescript/no-use-before-define

    opt: {[index: string]: any}; // eslint-disable-line no-undef, typescript/no-use-before-define
    config: {[index: string]: any}; // eslint-disable-line no-undef, typescript/no-use-before-define

    use(ware: any): Promise<Clipped>; // eslint-disable-line no-undef, typescript/no-use-before-define

    resolve(...paths: string[]): string; // eslint-disable-line no-undef, typescript/no-use-before-define
  }
}

const stockPresets: {[index:string] : {ware: any}} = {}

/**
 * basePreset - Initializes default value
 *
 * @export
 * @param {Clipped} this
 * @param {Object} [opt={}]
 */
export function basePreset(this: Clipped, opt: Object = {}): void {
  // Initialize config
  this.opt = opt
  Object.assign(this, opt)
  this.config = createChainable({
    context: this.opt.context || process.cwd()
  })

  let packageJson: any = {}
  try {
    packageJson = require(this.resolve('package.json'))
  } catch (error) {}

  Object.assign(this.config, ({
    name: packageJson.name,
    src: this.resolve('src'),
    dist: this.resolve('dist'),
    dockerTemplate: this.resolve('docker-template'),
    packageJson
  }))

  this.hook('version')
    .add('clipped', async (clipped: Clipped) => {
      clipped.print(await clipped.exec('npm view clipped version'))
    })

  this.__initialized__ = true
}

/**
 * NormalizePreset - Normalize normalize to same format
 *
 * @param {any} ware
 *
 * @returns {Function}
 */
function normalizePreset(this: Clipped, ware: any): any {
  const preset = ware.default || ware
  if (isString(preset)) { // String i.e. stock
    return stockPresets[preset]
  }

  if (isFunction(preset)) { // Function
    return preset
  }
  
  // Config mutation
  if (isPlainObject(preset)) {
    this.defer(preset)
  }

  if (Array.isArray(preset)) {
    return preset
  }
}

export async function execPreset(this: Clipped, ware: any = () => {}): Promise<Clipped> {
  for (let w of [].concat(ware).map(normalizePreset.bind(this)).filter(Boolean)) {
    const res = await (isFunction(w) ? w.call(this, this) : execPreset.call(this, w))
    if (res !== null && res !== undefined) {
      await execPreset.call(this, res)
    }
  }

  return this
}

export function initPreset(clipped: typeof Clipped): void {
  clipped.prototype.use = execPreset
}
