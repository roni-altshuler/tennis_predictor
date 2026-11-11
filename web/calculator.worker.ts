import { type Calculation, calculate, type WorkerReply } from "./model";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<Calculation>) => void;
  postMessage: (reply: WorkerReply) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ result: calculate(data) });
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : "Calculation failed." });
  }
};
