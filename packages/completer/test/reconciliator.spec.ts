import {
  CompletionHandler,
  ICompletionContext,
  ICompletionProvider,
  ProviderReconciliator
} from '@jupyterlab/completer';

const mockContext: ICompletionContext = {
  widget: null as any
};

class TestCompletionProvider implements ICompletionProvider {
  constructor(
    private options: {
      identifier?: string;
      isApplicableResult?: boolean | Promise<boolean>;
      isApplicableDelay?: number;
      shouldReject?: boolean;
      shouldNeverResolve?: boolean;
      fetchResult?: any;
    } = {}
  ) {
    this.identifier = options.identifier ?? 'TestProvider';
  }

  readonly identifier: string;
  readonly rank?: number;
  readonly renderer = null;

  async isApplicable(context: ICompletionContext): Promise<boolean> {
    if (this.options.shouldNeverResolve) {
      return new Promise(() => {
        // Intentionally never resolves
      });
    }

    if (this.options.shouldReject) {
      throw new Error(`Provider ${this.identifier} isApplicable() rejected`);
    }

    if (this.options.isApplicableDelay !== undefined) {
      await new Promise(resolve =>
        setTimeout(resolve, this.options.isApplicableDelay)
      );
    }

    if (this.options.isApplicableResult !== undefined) {
      return Promise.resolve(this.options.isApplicableResult);
    }

    return Promise.resolve(true);
  }

  async fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    return Promise.resolve(
      this.options.fetchResult ?? { start: 0, end: 0, items: [] }
    );
  }
}

describe('completer/reconciliator', () => {
  describe('ProviderReconciliator#fetch()', () => {
    let consoleErrorSpy: jest.SpyInstance;
    const mockRequest: CompletionHandler.IRequest = {
      text: '',
      offset: 0
    };

    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => { });
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    describe('successful providers', () => {
      it('should call fetch on provider when isApplicable() resolves to true', async () => {
        const provider = new TestCompletionProvider({
          isApplicableResult: true
        });
        const fetchSpy = jest.spyOn(provider, 'fetch');
        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [provider],
          timeout: 1000
        });

        await reconciliator.fetch(mockRequest);

        expect(fetchSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should NOT call fetch on provider when isApplicable() resolves to false', async () => {
        const provider = new TestCompletionProvider({
          isApplicableResult: false
        });
        const fetchSpy = jest.spyOn(provider, 'fetch');
        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [provider],
          timeout: 1000
        });

        await reconciliator.fetch(mockRequest);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('rejecting providers', () => {
      it('should skip provider when isApplicable() rejects and log error', async () => {
        const provider = new TestCompletionProvider({
          identifier: 'FailingProvider',
          shouldReject: true
        });
        const fetchSpy = jest.spyOn(provider, 'fetch');
        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [provider],
          timeout: 1000
        });

        await reconciliator.fetch(mockRequest);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Error)
        );
      });
    });

    describe('timeout behavior', () => {
      it('should skip provider when isApplicable() times out', async () => {
        const provider = new TestCompletionProvider({
          identifier: 'SlowProvider',
          shouldNeverResolve: true
        });
        const fetchSpy = jest.spyOn(provider, 'fetch');
        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [provider],
          timeout: 100 // Short timeout for test speed
        });

        const startTime = Date.now();
        await reconciliator.fetch(mockRequest);
        const elapsedTime = Date.now() - startTime;

        expect(fetchSpy).not.toHaveBeenCalled();
        // Explicitly wait >= timeout to ensure the timeout logic has fired.
        // We use a slight buffer (90ms for 100ms) to account for JS event loop jitter,
        // but generally we expect the timeout to have happened.
        expect(elapsedTime).toBeGreaterThanOrEqual(90);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });

      it('should use a default timeout when timeout is undefined', async () => {
        const provider = new TestCompletionProvider({
          shouldNeverResolve: true
        });
        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [provider],
          timeout: undefined as any
        });

        const startTime = Date.now();
        await reconciliator.fetch(mockRequest);
        const elapsedTime = Date.now() - startTime;

        // Verify it didn't hang forever, but waited a reasonable amount
        // We assume default > 1000ms
        expect(elapsedTime).toBeGreaterThan(1000);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should skip slow provider but fetch from fast provider', async () => {
        const fastProvider = new TestCompletionProvider({
          identifier: 'FastProvider',
          isApplicableResult: true,
          isApplicableDelay: 10
        });
        const slowProvider = new TestCompletionProvider({
          identifier: 'SlowProvider',
          shouldNeverResolve: true
        });
        const fetchSpyFast = jest.spyOn(fastProvider, 'fetch');
        const fetchSpySlow = jest.spyOn(slowProvider, 'fetch');

        const reconciliator = new ProviderReconciliator({
          context: mockContext,
          providers: [fastProvider, slowProvider],
          timeout: 100
        });

        await reconciliator.fetch(mockRequest);

        expect(fetchSpyFast).toHaveBeenCalled();
        expect(fetchSpySlow).not.toHaveBeenCalled();
      });
    });
  });
});
