# TODO

## Things I still need to add

- Support for multiple forms of resources
  - inline object
  - path to file
  - path to dir of patients?

## Things to remove across configs:

-

## Things I'm not sure if we should remove/ want to check with Vlad

- Lenient – removed but should check
- addDestinationToManifest – still have it but is this as necessary? It feels nice to have but the bundles are so much smaller. I could see an argument for keeping it in order to reduce distance from bulk-data-client, but I'm open to opinions
- module.exports - to use [stable fetch we need to guarantee minimum node 21](https://nodejs.org/en/blog/announcements/v21-release-announce) so is used export/import syntax everywhere valid?

## Things I still need to test

- The smart data client - surely we have tests for this somewhere?

---

# DONE

- Removed parallelDownloads
- Removed lenient, not sure if this is ideal; might add back
- ndjsonMaxLineLength
- ndjsonValidateFHIRResourceType
- ndjsonValidateFHIRResourceCount
