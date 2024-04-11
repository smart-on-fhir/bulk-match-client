Things to remove across config:

- ndjsonMaxLineLength
- ndjsonValidateFHIRResourceType
- ndjsonValidateFHIRResourceCount

Things I'm not sure if we should remove?

- addDestinationToManifest

Things I still need to test

- The smart data client - surely we have tests for this somewhere?

Things I still need to add

- Support for multiple forms of resources
  - inline object
  - path to file
  - path to dir of patients?

---

DONE:

- Removed parallelDownloads
- Removed lenient, not sure if this is ideal; might add back
