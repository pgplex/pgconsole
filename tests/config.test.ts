import { describe, expect, it } from 'vitest'
import { getAIProviderById, loadConfigFromString } from '../server/lib/config'

describe('config AI providers', () => {
  it('parses optional AI provider base_url', async () => {
    await loadConfigFromString(`
[[ai.providers]]
id = "litellm"
name = "LiteLLM"
vendor = "openai"
model = "gpt-4o-mini"
api_key = "sk-test"
base_url = "https://litellm.example.com/v1"
`)

    expect(getAIProviderById('litellm')).toMatchObject({
      id: 'litellm',
      base_url: 'https://litellm.example.com/v1',
    })
  })

  it('trims AI provider base_url and removes trailing slashes', async () => {
    await loadConfigFromString(`
[[ai.providers]]
id = "proxy"
vendor = "anthropic"
model = "claude-sonnet-4-20250514"
api_key = "sk-ant-test"
base_url = "  https://proxy.example.com/anthropic///  "
`)

    expect(getAIProviderById('proxy')?.base_url).toBe('https://proxy.example.com/anthropic')
  })

  it('rejects non-string AI provider base_url', async () => {
    await expect(loadConfigFromString(`
[[ai.providers]]
id = "bad"
vendor = "google"
model = "gemini-2.5-pro"
api_key = "AIza-test"
base_url = 123
`)).rejects.toThrow('AI provider bad base_url must be a string')
  })

  it('rejects invalid AI provider base_url', async () => {
    await expect(loadConfigFromString(`
[[ai.providers]]
id = "bad"
vendor = "openai"
model = "gpt-4o"
api_key = "sk-test"
base_url = "not a url"
`)).rejects.toThrow('AI provider bad base_url is not a valid URL: not a url')
  })
})
