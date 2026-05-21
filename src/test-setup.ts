// Polyfill DataTransfer for jsdom — jsdom does not implement DataTransfer.
// We only need the minimal surface used by FileUpload: items.add(), files.
if (typeof globalThis.DataTransfer === 'undefined') {
  class DataTransferItemList {
    private _files: File[] = []

    add(file: File): void {
      this._files.push(file)
    }

    get length(): number {
      return this._files.length
    }

    get _fileList(): File[] {
      return this._files
    }
  }

  class DataTransferPolyfill {
    items: DataTransferItemList

    constructor() {
      this.items = new DataTransferItemList()
    }

    get files(): FileList {
      const files = this.items._fileList
      // Build a FileList-like object
      const fileList = Object.create({
        item: (index: number) => files[index] ?? null,
        [Symbol.iterator]: function* () {
          for (const f of files) yield f
        },
      })
      Object.defineProperty(fileList, 'length', { get: () => files.length })
      for (let i = 0; i < files.length; i++) {
        fileList[i] = files[i]
      }
      return fileList as unknown as FileList
    }
  }

  // @ts-expect-error — polyfill for jsdom
  globalThis.DataTransfer = DataTransferPolyfill
}
