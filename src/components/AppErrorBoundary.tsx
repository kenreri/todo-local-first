import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render failed", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-[var(--ink)]">
        <section className="ui-card w-full max-w-md p-6">
          <h1 className="text-2xl font-semibold">
            {"\u9875\u9762\u52a0\u8f7d\u5931\u8d25"}
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            {
              "\u53ef\u80fd\u662f\u5e94\u7528\u66f4\u65b0\u540e\u4ecd\u5728\u4f7f\u7528\u65e7\u7f13\u5b58\u3002\u8bf7\u91cd\u65b0\u52a0\u8f7d\u9875\u9762\uff0c\u4efb\u52a1\u6570\u636e\u4e0d\u4f1a\u88ab\u5220\u9664\u3002"
            }
          </p>
          <button
            className="mt-6 rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-[var(--on-accent)]"
            type="button"
            onClick={() => this.setState({ hasError: false })}
          >
            {"\u91cd\u65b0\u52a0\u8f7d"}
          </button>
        </section>
      </main>
    );
  }
}
