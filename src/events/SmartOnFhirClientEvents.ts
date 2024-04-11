import { EventEmitter } from "events";
import { SmartOnFhirClient } from "../client";

/**>>
 * The SmartOnFhirClient instances emit the following events:
 */
export interface SmartOnFhirClientEvents {
  /**
   * Emitted every time new access token is received
   * @event
   */
  authorize: (this: SmartOnFhirClient, accessToken: string) => void;

  /**
   * Emitted on error
   * @event
   */
  error: (this: SmartOnFhirClient, error: Error) => void;

  /**
   * Emitted when the flow is aborted by the user
   * @event
   */
  abort: (this: SmartOnFhirClient) => void;
}
