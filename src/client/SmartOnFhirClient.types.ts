export interface SmartOnFhirClientType {
  on<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    listener: SmartOnFhirClientEvents[U],
  ): this;
  // on(event: string, listener: Function): this;

  emit<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    ...args: Parameters<SmartOnFhirClientEvents[U]>
  ): boolean;
  // emit(event: string, ...args: any[]): boolean;

  off<U extends keyof SmartOnFhirClientEvents>(
    event: U,
    listener: SmartOnFhirClientEvents[U],
  ): this;
  // on(event: string, listener: Function): this;
}

/**>>
 * The SmartOnFhirClient instances emit the following events:
 */
export interface SmartOnFhirClientEvents {
  /**
   * Emitted every time new access token is received
   * @event
   */
  authorize: (this: SmartOnFhirClientType, accessToken: string) => void;

  /**
   * Emitted on error
   * @event
   */
  error: (this: SmartOnFhirClientType, error: Error) => void;

  /**
   * Emitted when the flow is aborted by the user
   * @event
   */
  abort: (this: SmartOnFhirClientType) => void;
}
