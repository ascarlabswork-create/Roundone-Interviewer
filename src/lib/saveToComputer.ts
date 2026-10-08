export class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled')
    this.name = 'SaveCancelledError'
  }
}

export function fileSafeName(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 80) || 'interview'
}

export function interviewFileName(kind: 'recording' | 'notes', candidateName: string, at: Date | string) {
  const date = (at instanceof Date ? at : new Date(at)).toISOString().slice(0, 10)
  const person = fileSafeName(candidateName)
  return kind === 'notes' ? `interview-notes-${person}-${date}.txt` : `interview-recording-${person}-${date}.mp4`
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError'
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

function pickerTypes(fileName: string, mimeType: string) {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : ''
  if (!extension) return undefined
  return [{ description: 'File', accept: { [mimeType]: [extension] } }]
}

async function pickSaveLocation(fileName: string, mimeType: string) {
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker
  if (!picker) return null
  try {
    return await picker({
      suggestedName: fileName,
      types: pickerTypes(fileName, mimeType),
    })
  } catch (error) {
    if (isAbortError(error)) throw new SaveCancelledError()
    return null
  }
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

export async function createComputerSaveTarget(fileName: string, mimeType: string) {
  const handle = await pickSaveLocation(fileName, mimeType)
  return {
    async write(blob: Blob) {
      if (!handle) {
        triggerBrowserDownload(blob, fileName)
        return
      }
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    },
  }
}

export async function saveBlobToComputer(blob: Blob, fileName: string, mimeType: string) {
  const target = await createComputerSaveTarget(fileName, mimeType)
  await target.write(blob)
}

export async function saveTextToComputer(text: string, fileName: string) {
  await saveBlobToComputer(new Blob([text], { type: 'text/plain' }), fileName, 'text/plain')
}
