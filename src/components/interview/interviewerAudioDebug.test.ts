import { Track } from 'livekit-client'
import { describe, expect, it } from 'vitest'
import { publishSourceForTrack } from './interviewerAudioDebug.ts'

describe('publishSourceForTrack', () => {
  it('labels audio as a microphone publication', () => {
    expect(publishSourceForTrack({ kind: 'audio' } as MediaStreamTrack)).toEqual({
      source: Track.Source.Microphone,
    })
  })

  it('labels video as a camera publication', () => {
    expect(publishSourceForTrack({ kind: 'video' } as MediaStreamTrack)).toEqual({
      source: Track.Source.Camera,
    })
  })
})
