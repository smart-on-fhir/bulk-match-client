# TODO

## Things I still need to add

- Support for multiple forms of resources
  - inline object
    - Implement X
    - Test X
  - path to file
    - Implement X
    - Test X
  - path to dir of patients?
    - Implement X
    - Test X
  - Consider NDJSON format for resource definitions X & TEST
- Fix events (signatures, remove unnecessary)
  - kickOffStart
  - kickOffEnd
  - kickOffError
  - jobStart
  - jobProgress
  - jobError
  - jobComplete
  - downloadStart
  - downloadError
  - downloadComplete
  - allDownloadsComplete
  - downloads
  - authorize
  - error
  - abort

## Things to remove:

- Clean up Download types (so much unnecessary info on there from file-download days)

## Things I'm not sure if we should remove/ want to check with Vlad

- Lenient – removed but should check
- addDestinationToManifest – still have it but is this as necessary? It feels nice to have but the bundles are so much smaller. I could see an argument for keeping it in order to reduce distance from bulk-data-client, but I'm open to opinions

## Things I still need to test

- The smart data client - surely we have tests for this somewhere?

---

# DONE

- Removed parallelDownloads
- Removed lenient, not sure if this is ideal; might add back
- ndjsonMaxLineLength
- ndjsonValidateFHIRResourceType
- ndjsonValidateFHIRResourceCount
- module.exports - to use [stable fetch we need to guarantee minimum node 21](https://nodejs.org/en/blog/announcements/v21-release-announce) so is used export/import syntax everywhere valid? Related – do we want to just type the project as "module" altogether? e.g. change the compilation target in our tsconfig accordingly?
