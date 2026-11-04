// Preloaded into the example subprocess by the tests: any network attempt fails loudly.
import net from "node:net";

const deny = () => {
  throw new Error("NETWORK_ACCESS_DENIED_IN_TEST");
};
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
