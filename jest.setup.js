// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill for Request/Response objects needed for Next.js API routes
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock Request and Response for API route tests
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body
    }

    async json() {
      return JSON.parse(this.body)
    }
  }
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.headers = new Map(Object.entries(init?.headers || {}))
    }

    async json() {
      return JSON.parse(this.body)
    }
  }
}
