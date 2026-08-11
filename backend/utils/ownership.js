// Shared by every controller reachable through the identifyUser middleware
// (videoController, captionController, transcribeController,
// translateController). identifyUser guarantees exactly one of req.user /
// req.guestId is set — these two helpers are the single place that decides
// what "owns this document" means, so ownership logic can't drift between
// controllers.

// Fields to stamp onto a new Video/Caption on creation.
export const ownerFields = (req) =>
  req.user ? { user: req.user._id } : { guestId: req.guestId };

// Does the current request (user or guest) own this document?
export const isOwner = (doc, req) =>
  req.user
    ? !!doc.user && doc.user.toString() === req.user._id.toString()
    : !!req.guestId && doc.guestId === req.guestId;
