# Mistral Large 4 in Cursor

Use the Continue extension in Cursor to give Mistral its own provider configuration.

- Extension ID `Continue.continue`
- Model ID `mistralai/mistral-large-4-1t-a52b`
- API base URL `https://integrate.api.nvidia.com/v1`
- Protocol `/chat/completions`

## Activate

1. Revoke the NVIDIA key shared in chat and create a replacement.
2. Open or create `%USERPROFILE%\.continue\.env` and add `NVIDIA_API_KEY=your-replacement-key`. Keep the key outside the repository.
3. Reload the Cursor window, open the Continue sidebar, and select **Mistral Large 4**.
4. Try a synthetic prompt in Continue chat, such as “Write a Python function that returns the average of a list, or zero if it is empty.”

If the local model configuration needs to be recreated, save this to `%USERPROFILE%\.continue\config.yaml`. If a config already exists, append only the model entry to its existing `models` list.

```yaml
name: NVIDIA Coding
version: 1.0.0
schema: v1
models:
  - name: Mistral Large 4
    provider: openai
    model: mistralai/mistral-large-4-1t-a52b
    apiBase: https://integrate.api.nvidia.com/v1
    useResponsesApi: false
    apiKey: ${{ secrets.NVIDIA_API_KEY }}
    roles: [chat, edit]
```

The direct NVIDIA API returned a correct function for the synthetic coding test. A request from the Cursor extension with the replacement key is the remaining verification step.

[Continue provider settings](https://docs.continue.dev/customize/model-providers/top-level/openai) · [Continue local secrets](https://docs.continue.dev/faqs)
