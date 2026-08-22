export function createInFlightAuthRequestCoalescer<Result>() {
  const requests = new Map<string, Promise<Result>>();

  return function run(
    key: string,
    createRequest: () => Promise<Result>,
  ): Promise<Result> {
    const existingRequest = requests.get(key);

    if (existingRequest) {
      return existingRequest;
    }

    const request = Promise.resolve().then(createRequest);
    requests.set(key, request);

    const clearRequest = () => {
      if (requests.get(key) === request) {
        requests.delete(key);
      }
    };

    void request.then(clearRequest, clearRequest);

    return request;
  };
}
