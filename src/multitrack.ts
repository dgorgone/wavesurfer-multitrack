/**
 * Multitrack is a super-plugin for creating a multitrack audio player.
 * Individual tracks are synced and played together.
 * They can be dragged to set their start position.
 * The top track is meant for dragging'n'dropping an additional track id (not a file).
 */

import WaveSurfer, { type WaveSurferOptions } from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import TimelinePlugin, { type TimelinePluginOptions } from 'wavesurfer.js/dist/plugins/timeline.js'
import EnvelopePlugin, { type EnvelopePoint, type EnvelopePluginOptions } from 'wavesurfer.js/dist/plugins/envelope.js'
import EventEmitter from 'wavesurfer.js/dist/event-emitter.js'
import { makeDraggable } from 'wavesurfer.js/dist/draggable.js'
import WebAudioPlayer from './webaudio.js'

export type TrackId = string | number

type SingleTrackOptions = Omit<
  WaveSurferOptions,
  'container' | 'minPxPerSec' | 'cursorColor' | 'cursorWidth' | 'interact' | 'hideScrollbar'
>

export type TrackOptions = {
  id: TrackId
  url?: string
  peaks?: WaveSurferOptions['peaks']
  envelope?: boolean | EnvelopePoint[]
  draggable?: boolean
  startPosition: number
  startCue?: number
  endCue?: number
  fadeInEnd?: number
  fadeOutStart?: number
  volume?: number
  markers?: Array<{
    time: number
    label?: string
    color?: string
  }>
  intro?: {
    endTime: number
    label?: string
    color?: string
  }
  options?: SingleTrackOptions
}

export type MultitrackOptions = {
  container: HTMLElement
  minPxPerSec?: number
  cursorColor?: string
  cursorWidth?: number
  trackBackground?: string
  trackBorderColor?: string
  rightButtonDrag?: boolean
  dragBounds?: boolean
  envelopeOptions?: EnvelopePluginOptions
  timelineOptions?: TimelinePluginOptions
}

export type MultitrackEvents = {
  canplay: []
  'start-position-change': [{ id: TrackId; startPosition: number }]
  'start-cue-change': [{ id: TrackId; startCue: number }]
  'end-cue-change': [{ id: TrackId; endCue: number }]
  'fade-in-change': [{ id: TrackId; fadeInEnd: number }]
  'fade-out-change': [{ id: TrackId; fadeOutStart: number }]
  'envelope-points-change': [{ id: TrackId; points: EnvelopePoint[] }]
  'volume-change': [{ id: TrackId; volume: number }]
  'intro-end-change': [{ id: TrackId; endTime: number }]
  drop: [{ id: TrackId }]
}

export type MultitrackTracks = Array<TrackOptions>

const silentWavBase64v1 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA//////////////////////////////////////////////////////////////////////8=";
const silentWavBase64v2 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // https://github.com/katspaugh/wavesurfer.js/discussions/2774
const placeholderUrl = "data:audio/wav;base64," + silentWavBase64v2;
const webkitUrl = "data:audio/mpeg;base64,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";

const PLACEHOLDER_TRACK = {
  id: 'placeholder',
  //url: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV',
  url: webkitUrl,
  peaks: [[0]],
  startPosition: 0,
  options: { height: 0 },
}

class MultiTrack extends EventEmitter<MultitrackEvents> {
  private tracks: MultitrackTracks
  private options: MultitrackOptions
  private audios: Array<HTMLAudioElement | WebAudioPlayer> = []
  private wavesurfers: Array<WaveSurfer> = []
  private envelopes: Array<EnvelopePlugin> = []
  private durations: Array<number> = []
  private currentTime = 0
  private maxDuration = 0
  private rendering: ReturnType<typeof initRendering>
  private frameRequest: number | null = null
  private subscriptions: Array<() => void> = []
  private audioContext: AudioContext

  static create(tracks: MultitrackTracks, options: MultitrackOptions): MultiTrack {
    return new MultiTrack(tracks, options)
  }

  constructor(tracks: MultitrackTracks, options: MultitrackOptions) {
    super()

    this.audioContext = new AudioContext()

    this.tracks = tracks.concat({ ...PLACEHOLDER_TRACK }).map((track) => ({
      ...track,
      startPosition: track.startPosition || 0,
      peaks: track.peaks || (track.url || track.options?.media ? undefined : [new Float32Array()]),
    }))
    this.options = options

    this.rendering = initRendering(this.tracks, this.options)

    this.rendering.addDropHandler((trackId: TrackId) => {
      this.emit('drop', { id: trackId })
    })

    this.initAllAudios().then((durations) => {
      this.initDurations(durations)

      this.initAllWavesurfers()

      this.rendering.containers.forEach((container, index) => {
        if (tracks[index]?.draggable) {
          const unsubscribe = initDragging(
            container,
            (delta: number) => this.onDrag(index, delta),
            options.rightButtonDrag,
          )
          this.wavesurfers[index].once('destroy', unsubscribe)
        }
      })

      this.rendering.addClickHandler((position) => {
        this.seekTo(position)
      })

      this.emit('canplay')
    })
  }

  private initDurations(durations: number[]) {
    this.durations = durations

    this.maxDuration = this.tracks.reduce((max, track, index) => {
      return Math.max(max, track.startPosition + durations[index])
    }, 0)

    const placeholderAudioIndex = this.audios.findIndex((a) => a.src === PLACEHOLDER_TRACK.url)
    const placeholderAudio = this.audios[placeholderAudioIndex]
    if (placeholderAudio) {
      ;(placeholderAudio as WebAudioPlayer & { duration: number }).duration = this.maxDuration
      this.durations[placeholderAudioIndex] = this.maxDuration
    }

    this.rendering.setMainWidth(durations, this.maxDuration)
  }

  private initAudio(track: TrackOptions): Promise<HTMLAudioElement | WebAudioPlayer> {
    const isIOS = /iPhone|iPad/.test(navigator.userAgent)
    const isPlaceholderTrack = track.id === PLACEHOLDER_TRACK.id
    const audio =
      track.options?.media || (isIOS || isPlaceholderTrack ? new WebAudioPlayer(this.audioContext) : new Audio())

    audio.crossOrigin = 'anonymous'

    //if (!isPlaceholderTrack) {
      if (track.url) {
        audio.src = track.url
      }
    //}

    if (track.volume !== undefined) audio.volume = track.volume

    return new Promise<typeof audio>((resolve) => {
      if (!audio.src) return resolve(audio)
      if (isPlaceholderTrack) {
        // For placeholder, resolve immediately
        return resolve(audio)
      }
      (audio as HTMLAudioElement).addEventListener('loadedmetadata', () => resolve(audio), { once: true })
    })
  }

  private async initAllAudios(): Promise<number[]> {
    this.audios = await Promise.all(this.tracks.map((track) => this.initAudio(track)))
    return this.audios.map((a) => (a.src ? a.duration : 0))
  }

  private initWavesurfer(track: TrackOptions, index: number): WaveSurfer {
    const container = this.rendering.containers[index]

    // Create a wavesurfer instance
    const ws = WaveSurfer.create({
      ...track.options,
      container,
      minPxPerSec: 0,
      media: this.audios[index] as HTMLMediaElement,
      peaks:
        track.peaks ||
        (this.audios[index] instanceof WebAudioPlayer
          ? (this.audios[index] as WebAudioPlayer).getChannelData()
          : undefined),
      duration: this.durations[index],
      cursorColor: 'transparent',
      cursorWidth: 0,
      interact: false,
      hideScrollbar: true,
    })

    if (track.id === PLACEHOLDER_TRACK.id) {
      ws.registerPlugin(
        TimelinePlugin.create({
          container: this.rendering.containers[0].parentElement,
          ...this.options.timelineOptions,
        } as TimelinePluginOptions),
      )
    }

    // Regions and markers
    const wsRegions = RegionsPlugin.create()
    ws.registerPlugin(wsRegions)

    this.subscriptions.push(
      ws.once('decode', () => {
        // Start and end cues
        if (track.startCue != null || track.endCue != null) {
          const { startCue = 0, endCue = this.durations[index] } = track
          const startCueRegion = wsRegions.addRegion({
            start: 0,
            end: startCue,
            color: 'rgba(0, 0, 0, 0.7)',
            drag: false,
          })
          const endCueRegion = wsRegions.addRegion({
            start: endCue,
            end: this.durations[index],
            color: 'rgba(0, 0, 0, 0.7)',
            drag: false,
          })

          // Allow resizing only from one side
          startCueRegion.element.firstElementChild?.remove()
          endCueRegion.element.lastChild?.remove()

          // Update the start and end cues on resize
          this.subscriptions.push(
            startCueRegion.on('update-end', () => {
              track.startCue = startCueRegion.end
              this.emit('start-cue-change', { id: track.id, startCue: track.startCue as number })
            }),

            endCueRegion.on('update-end', () => {
              track.endCue = endCueRegion.start
              this.emit('end-cue-change', { id: track.id, endCue: track.endCue as number })
            }),
          )
        }

        // Intro
        if (track.intro) {
          const introRegion = wsRegions.addRegion({
            start: 0,
            end: track.intro.endTime,
            content: track.intro.label,
            color: this.options.trackBackground,
            drag: false,
          })
          introRegion.element.querySelector('[part*="region-handle-left"]')?.remove()
          ;(introRegion.element.parentElement as HTMLElement).style.mixBlendMode = 'plus-lighter'
          if (track.intro.color) {
            const rightHandle = introRegion.element.querySelector('[part*="region-handle-right"]') as HTMLElement
            if (rightHandle) {
              rightHandle.style.borderColor = track.intro.color
            }
          }

          this.subscriptions.push(
            introRegion.on('update-end', () => {
              this.emit('intro-end-change', { id: track.id, endTime: introRegion.end })
            }),
          )
        }

        // Render markers
        if (track.markers) {
          track.markers.forEach((marker) => {
            wsRegions.addRegion({
              start: marker.time,
              content: marker.label,
              color: marker.color,
              resize: false,
            })
          })
        }
      }),
    )

    if (track.envelope) {
      // Envelope
      const envelope = ws.registerPlugin(
        EnvelopePlugin.create({
          ...this.options.envelopeOptions,
          volume: track.volume,
        }),
      )

      if (Array.isArray(track.envelope)) {
        envelope.setPoints(track.envelope)
      }

      if (track.fadeInEnd) {
        if (track.startCue) {
          envelope.addPoint({ time: track.startCue || 0, volume: 0, id: 'startCue' })
        }
        envelope.addPoint({ time: track.fadeInEnd || 0, volume: track.volume ?? 1, id: 'fadeInEnd' })
      }

      if (track.fadeOutStart) {
        envelope.addPoint({ time: track.fadeOutStart, volume: track.volume ?? 1, id: 'fadeOutStart' })
        if (track.endCue) {
          envelope.addPoint({ time: track.endCue, volume: 0, id: 'endCue' })
        }
      }

      this.envelopes[index] = envelope

      const setPointTimeById = (id: string, time: number) => {
        const points = envelope.getPoints()
        const newPoints = points.map((point) => {
          if (point.id === id) {
            return { ...point, time }
          }
          return point
        })
        envelope.setPoints(newPoints)
      }

      let prevFadeInEnd = track.fadeInEnd
      let prevFadeOutStart = track.fadeOutStart

      this.subscriptions.push(
        envelope.on('volume-change', (volume) => {
          this.emit('volume-change', { id: track.id, volume })
        }),

        envelope.on('points-change', (points) => {
          const fadeIn = points.find((point) => point.id === 'fadeInEnd')
          if (fadeIn && fadeIn.time !== prevFadeInEnd) {
            this.emit('fade-in-change', { id: track.id, fadeInEnd: fadeIn.time })
            prevFadeInEnd = fadeIn.time
          }

          const fadeOut = points.find((point) => point.id === 'fadeOutStart')
          if (fadeOut && fadeOut.time !== prevFadeOutStart) {
            this.emit('fade-out-change', { id: track.id, fadeOutStart: fadeOut.time })
            prevFadeOutStart = fadeOut.time
          }

          this.emit('envelope-points-change', { id: track.id, points })
        }),

        this.on('start-cue-change', ({ id, startCue }) => {
          if (id === track.id) {
            setPointTimeById('startCue', startCue)
          }
        }),

        this.on('end-cue-change', ({ id, endCue }) => {
          if (id === track.id) {
            setPointTimeById('endCue', endCue)
          }
        }),

        ws.on('decode', () => {
          envelope.setVolume(track.volume ?? 1)
        }),
      )
    }

    return ws
  }

  private initAllWavesurfers() {
    const wavesurfers = this.tracks.map((track, index) => {
      return this.initWavesurfer(track, index)
    })

    this.wavesurfers = wavesurfers
  }

  private updatePosition(time: number, autoCenter = false) {
    const precisionSeconds = 0.3
    const isPaused = !this.isPlaying()

    if (time !== this.currentTime) {
      this.currentTime = time
      this.rendering.updateCursor(time / this.maxDuration, autoCenter)
    }

    // Update the current time of each audio
    this.tracks.forEach((track, index) => {
      const audio = this.audios[index]
      const duration = this.durations[index]
      const newTime = time - track.startPosition

      if (Math.abs(audio.currentTime - newTime) > precisionSeconds) {
        audio.currentTime = Math.max(0, newTime)
      }

      // If the position is out of the track bounds, pause it
      if (isPaused || newTime < 0 || newTime > duration) {
        !audio.paused && audio.pause()
      } else if (!isPaused) {
        // If the position is in the track bounds, play it
        audio.paused && audio.play()
      }

      // Unmute if cue is reached
      const isMuted = newTime < (track.startCue || 0) || newTime > (track.endCue || Infinity)
      if (isMuted != audio.muted) audio.muted = isMuted
    })
  }

  private onDrag(index: number, delta: number) {
    const track = this.tracks[index]
    if (!track.draggable) return

    const newStartPosition = track.startPosition + delta * this.maxDuration
    const minStart = this.options.dragBounds ? 0 : -this.durations[index] - 1
    const maxStart = this.maxDuration - this.durations[index]

    if (newStartPosition >= minStart && newStartPosition <= maxStart) {
      track.startPosition = newStartPosition
      this.initDurations(this.durations)
      this.rendering.setContainerOffsets()
      this.updatePosition(this.currentTime)
      this.emit('start-position-change', { id: track.id, startPosition: newStartPosition })
    }
  }

  private findCurrentTracks(): number[] {
    // Find the audios at the current time
    const indexes: number[] = []

    this.tracks.forEach((track, index) => {
      if (
        (track.url || track.options?.media) &&
        this.currentTime >= track.startPosition &&
        this.currentTime < track.startPosition + this.durations[index]
      ) {
        indexes.push(index)
      }
    })

    if (indexes.length === 0) {
      const minStartTime = Math.min(...this.tracks.filter((t) => t.url).map((track) => track.startPosition))
      indexes.push(this.tracks.findIndex((track) => track.startPosition === minStartTime))
    }

    return indexes
  }

  private startSync() {
    const onFrame = () => {
      const position = this.audios.reduce<number>((pos, audio, index) => {
        if (!audio.paused) {
          pos = Math.max(pos, audio.currentTime + this.tracks[index].startPosition)
        }
        return pos
      }, this.currentTime)

      if (position > this.currentTime) {
        this.updatePosition(position, true)
      }

      this.frameRequest = requestAnimationFrame(onFrame)
    }

    onFrame()
  }

  public play() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    this.startSync()

    const indexes = this.findCurrentTracks()
    indexes.forEach((index) => {
      this.audios[index]?.play()
    })
  }

  public pause() {
    this.audios.forEach((audio) => audio.pause())
  }

  /**
   * Gets the current playback rate of the audio tracks.
   * @returns The playback rate of the first audio track, or 1 if no tracks exist.
   */
  public getAudioRate(): number {
    return this.audios.length > 0 ? this.audios[0].playbackRate : 1
  }

  /**
   * Sets the playback rate for all audio tracks to maintain synchronization.
   * @param rate The playback rate (between 0.25 and 5.0).
   * @throws {Error} If the rate is outside the valid range.
   */
  public setAudioRate(rate: number) {
    if (rate < 0.25 || rate > 5.0) {
      throw new Error('Playback rate must be between 0.25 and 5.0')
    }
    this.audios.forEach((audio) => {
      audio.playbackRate = rate
    })
  }

  public isPlaying() {
    return this.audios.some((audio) => !audio.paused)
  }

  public getCurrentTime() {
    return this.currentTime
  }

  /** Position percentage from 0 to 1 */
  public seekTo(position: number) {
    const wasPlaying = this.isPlaying()
    this.updatePosition(position * this.maxDuration)
    if (wasPlaying) this.play()
  }

  /** Set time in seconds */
  public setTime(time: number) {
    const wasPlaying = this.isPlaying()
    this.updatePosition(time)
    if (wasPlaying) this.play()
  }

  public zoom(pxPerSec: number) {
    this.options.minPxPerSec = pxPerSec
    this.wavesurfers.forEach((ws, index) => this.tracks[index].url && ws.zoom(pxPerSec))
    this.rendering.setMainWidth(this.durations, this.maxDuration)
    this.rendering.setContainerOffsets()
  }

  public addTrack(track: TrackOptions) {
    const index = this.tracks.findIndex((t) => t.id === track.id)
    if (index !== -1) {
      this.tracks[index] = track

      this.initAudio(track).then((audio) => {
        this.audios[index] = audio
        //ORIGINAL CODE: this.durations[index] = audio.duration
        this.durations[index] = typeof track.options?.duration === 'number' ? track.options.duration : audio.duration
        this.initDurations(this.durations)

        const container = this.rendering.containers[index]
        container.innerHTML = ''

        this.wavesurfers[index].destroy()
        this.wavesurfers[index] = this.initWavesurfer(track, index)

        const unsubscribe = initDragging(
          container,
          (delta: number) => this.onDrag(index, delta),
          this.options.rightButtonDrag,
        )
        this.wavesurfers[index].once('destroy', unsubscribe)

        this.emit('canplay')
      })
    }
  }

  public destroy() {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest)

    this.rendering.destroy()

    this.audios.forEach((audio) => {
      audio.pause()
      audio.src = ''
    })

    this.wavesurfers.forEach((ws) => {
      ws.destroy()
    })
  }

  // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
  public setSinkId(sinkId: string): Promise<void[]> {
    return Promise.all(this.wavesurfers.map((ws) => ws.setSinkId(sinkId)))
  }

  public setTrackVolume(index: number, volume: number) {
    ;(this.envelopes[index] || this.wavesurfers[index])?.setVolume(volume)
  }

  public setTrackStartPosition(index: number, value: number) {
    const track = this.tracks[index]
    if (!track.draggable) return

    const newStartPosition = value
    const minStart = this.options.dragBounds ? 0 : -this.durations[index] - 1
    const maxStart = this.maxDuration - this.durations[index]

    if (newStartPosition >= minStart && newStartPosition <= maxStart) {
      track.startPosition = newStartPosition
      this.initDurations(this.durations)
      this.rendering.setContainerOffsets()
      this.updatePosition(this.currentTime)
      this.emit('start-position-change', { id: track.id, startPosition: newStartPosition })
    }
  }

  public getEnvelopePoints(trackIndex: number): EnvelopePoint[] | undefined {
    return this.envelopes[trackIndex]?.getPoints()
  }

  public setEnvelopePoints(trackIndex: number, points: EnvelopePoint[]) {
    this.envelopes[trackIndex]?.setPoints(points)
  }
}

function initRendering(tracks: MultitrackTracks, options: MultitrackOptions) {
  let pxPerSec = 0
  let durations: number[] = []
  let mainWidth = 0

  // Create a common container for all tracks
  const scroll = document.createElement('div')
  scroll.setAttribute('style', 'width: 100%; overflow-x: scroll; overflow-y: hidden; user-select: none;')
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  scroll.appendChild(wrapper)
  options.container.appendChild(scroll)

  // Create a common cursor
  const cursor = document.createElement('div')
  cursor.setAttribute('style', 'height: 100%; position: absolute; z-index: 10; top: 0; left: 0; pointer-events: none;')
  cursor.style.backgroundColor = options.cursorColor || '#000'
  cursor.style.width = `${options.cursorWidth ?? 1}px`
  wrapper.appendChild(cursor)
  const { clientWidth } = wrapper

  // Create containers for each track
  const containers = tracks.map((track, index) => {
    const container = document.createElement('div')
    container.style.position = 'relative'

    if (track.id === PLACEHOLDER_TRACK.id) {
      container.style.display = 'none'
    }

    if (options.trackBorderColor && index > 0) {
      const borderDiv = document.createElement('div')
      borderDiv.setAttribute('style', `width: 100%; height: 2px; background-color: ${options.trackBorderColor}`)
      wrapper.appendChild(borderDiv)
    }

    if (options.trackBackground && (track.url || track.options?.media)) {
      container.style.background = options.trackBackground
    }

    // No audio on this track, so make it droppable
    if (!(track.url || track.options?.media)) {
      const dropArea = document.createElement('div')
      dropArea.setAttribute(
        'style',
        `position: absolute; z-index: 10; left: 10px; top: 10px; right: 10px; bottom: 10px; border: 2px dashed ${options.trackBorderColor};`,
      )
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropArea.style.background = options.trackBackground || ''
      })
      dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault()
        dropArea.style.background = ''
      })
      dropArea.addEventListener('drop', (e) => {
        e.preventDefault()
        dropArea.style.background = ''
      })
      container.appendChild(dropArea)
    }

    wrapper.appendChild(container)

    return container
  })

  // Set the positions of each container
  const setContainerOffsets = () => {
    containers.forEach((container, i) => {
      const offset = tracks[i].startPosition * pxPerSec
      if (durations[i]) {
        container.style.width = `${durations[i] * pxPerSec}px`
      }
      container.style.transform = `translateX(${offset}px)`
    })
  }

  return {
    containers,

    // Set the start offset
    setContainerOffsets,

    // Set the container width
    setMainWidth: (trackDurations: number[], maxDuration: number) => {
      durations = trackDurations
      pxPerSec = Math.max(options.minPxPerSec || 0, clientWidth / maxDuration)
      mainWidth = pxPerSec * maxDuration
      wrapper.style.width = `${mainWidth}px`
      setContainerOffsets()
    },

    // Update cursor position
    updateCursor: (position: number, autoCenter: boolean) => {
      cursor.style.left = `${Math.min(100, position * 100)}%`

      // Update scroll
      const { clientWidth, scrollLeft } = scroll
      const center = clientWidth / 2
      const minScroll = autoCenter ? center : clientWidth
      const pos = position * mainWidth

      if (pos > scrollLeft + minScroll || pos < scrollLeft) {
        scroll.scrollLeft = pos - center
      }
    },

    // Click to seek
    addClickHandler: (onClick: (position: number) => void) => {
      wrapper.addEventListener('click', (e) => {
        const rect = wrapper.getBoundingClientRect()
        const x = e.clientX - rect.left
        const position = x / wrapper.offsetWidth
        onClick(position)
      })
    },

    // Destroy the container
    destroy: () => {
      scroll.remove()
    },

    // Do something on drop
    addDropHandler: (onDrop: (trackId: TrackId) => void) => {
      tracks.forEach((track, index) => {
        if (!(track.url || track.options?.media)) {
          const droppable = containers[index].querySelector('div')
          droppable?.addEventListener('drop', (e) => {
            e.preventDefault()
            onDrop(track.id)
          })
        }
      })
    },
  }
}

function initDragging(container: HTMLElement, onDrag: (delta: number) => void, rightButtonDrag = false) {
  let overallWidth = 0

  const unsubscribe = makeDraggable(
    container,
    (dx: number) => {
      onDrag(dx / overallWidth)
    },
    () => {
      container.style.cursor = 'grabbing'
      overallWidth = container.parentElement?.offsetWidth ?? 0
    },
    () => {
      container.style.cursor = 'grab'
    },
    5,
    rightButtonDrag ? 2 : 0,
  )

  const preventDefault = (e: Event) => e.preventDefault()

  container.style.cursor = 'grab'

  if (rightButtonDrag) {
    container.addEventListener('contextmenu', preventDefault)
  }

  return () => {
    container.style.cursor = ''
    unsubscribe()
    if (rightButtonDrag) {
      container.removeEventListener('contextmenu', preventDefault)
    }
  }
}

export default MultiTrack
