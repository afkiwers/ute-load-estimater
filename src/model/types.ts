// All masses are in kg, all distances in mm.
//
// Ute frame:     x = distance behind the FRONT axle (rearward positive)
//                y = lateral offset from the centreline (+ = right / driver side)
//                z = height above the ground
// Caravan frame: x = distance behind the COUPLING (tow ball) centre
//                y, z as above

export type Host = 'ute' | 'caravan';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Placement {
  host: Host;
  pos: Vec3;
}

export type ItemShape = 'box' | 'cylinder' | 'person' | 'bullbar' | 'boat' | 'outboard';

export interface ItemSize {
  l: number; // along x
  w: number; // along y
  h: number; // along z
}

export interface LoadItem {
  id: string;
  name: string;
  mass: number;
  size: ItemSize;
  shape: ItemShape;
  color: string;
  host: Host;
  /** Centre of mass in the host frame. */
  pos: Vec3;
  /** Part of the current scenario. Disabled items are shown ghosted and carry no load. */
  enabled: boolean;
  /**
   * Where the item was when the weighbridge readings were taken, or null if it
   * was not on the vehicle then. Its load at this placement is already inside
   * the measured baseline, so it is subtracted again before the current
   * placement is added.
   */
  measured: Placement | null;
  /** Snaps to seat positions instead of surfaces. */
  snap?: 'seat';
  templateId?: string;
}

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export interface UteLimits {
  gvm: number | null;
  gcm: number | null;
  frontAxle: number | null;
  rearAxle: number | null;
  kerb: number | null;
  tare: number | null;
  payload: number | null;
  brakedTow: number | null;
  unbrakedTow: number | null;
  towBallMax: number | null;
}

export interface TyreSpec {
  size: string;
  loadIndex: number | null;
  /** Rated load per tyre in kg, as a caravan compliance plate gives it; used instead of the load index when set. */
  loadKg: number | null;
}

export interface UteSpec {
  /** The model picked from the list (see vehicles.ts); its figures may have been edited since. */
  model: string;
  name: string;
  wheelbase: number;
  trackFront: number;
  trackRear: number;
  overallLength: number;
  overallWidth: number;
  overallHeight: number;
  /** Front axle centre to the front of the bumper. */
  frontOverhang: number;
  tub: {
    length: number;
    width: number;
    depth: number;
    floorHeight: number;
  };
  tyre: TyreSpec;
  limits: UteLimits;
  /** Front axle share of kerb weight, only used when nothing has been measured. */
  kerbFrontPct: number;
  /** Body colour in the 3D view. */
  paint: string;
  /** Panoramic sunroof in the 3D view. */
  sunroof: boolean;
}

export interface HitchSpec {
  /** Rear axle centre to tow ball centre. */
  ballOffset: number;
  ballHeight: number;
  towbarRating: number | null;
  towbarBallRating: number | null;
  wdh: {
    enabled: boolean;
    /** Front axle load restoration, % of the load the ball weight took off the front axle. */
    restorePct: number;
  };
}

export type TrailerKind = 'caravan' | 'boat' | 'enclosed' | 'open';

/**
 * The towed vehicle. It is called "caravan" throughout the code and in saved
 * setups for compatibility; `kind` says whether it is a caravan, a boat on its
 * trailer, an enclosed or an open trailer.
 */
export interface CaravanSpec {
  kind: TrailerKind;
  name: string;
  hasBrakes: boolean;
  /** Tow ball (coupling) centre to the centre of each axle, front first: one entry, or two for a tandem. */
  axles: number[];
  /**
   * Where the axles were when the readings (or the plated tare ball weight) were taken. Moving them
   * from here shifts the trailer's own weight between the ball and the axles.
   */
  weighedAxles: number[];
  track: number;
  /** Coupling centre to the front wall of the body (A-frame length). */
  bodyStart: number;
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
  floorHeight: number;
  tyre: TyreSpec;
  limits: {
    atm: number | null;
    gtm: number | null;
    tare: number | null;
    tareBall: number | null;
    /** Trailer gross axle load rating (TGALR): what the whole axle group may carry, from the compliance plate. */
    tgalr: number | null;
  };
}

export interface UteReadings {
  total: number | null;
  front: number | null;
  rear: number | null;
  fl: number | null;
  fr: number | null;
  rl: number | null;
  rr: number | null;
}

export interface CaravanReadings {
  /** Whole caravan on the weighbridge, unhitched. */
  total: number | null;
  /** Ball weight on a tow ball scale, caravan level. */
  ball: number | null;
  /** Axle group alone (coupled, or jockey wheel off the bridge). */
  axle: number | null;
  /** Tandem only: each axle on its own, one axle at a time on the weighbridge. */
  axleFront: number | null;
  axleRear: number | null;
  left: number | null;
  right: number | null;
}

export interface CheckSettings {
  /** Readings may disagree by max(tolAbs, tolPct %) before being flagged. */
  tolAbs: number;
  tolPct: number;
  /** Values at or above this % of a limit are shown as "near". */
  nearPct: number;
  ballPctMin: number;
  ballPctMax: number;
  /** Advisory warning when hitching takes more than this % off the front axle. */
  frontUnloadPct: number;
}

export interface Setup {
  id: string;
  name: string;
  updatedAt: number;
  ute: UteSpec;
  uteReadings: UteReadings;
  hitch: HitchSpec;
  towing: boolean;
  caravan: CaravanSpec;
  caravanReadings: CaravanReadings;
  items: LoadItem[];
  settings: CheckSettings;
  /** Dotted paths (e.g. "ute.limits.frontAxle") whose values are unverified placeholders. */
  placeholders: string[];
}
