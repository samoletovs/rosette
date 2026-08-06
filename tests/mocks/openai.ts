export class AzureOpenAI {
  chat = {
    completions: {
      create: async () => ({ choices: [{ message: { content: '' } }] }),
    },
  };
}
