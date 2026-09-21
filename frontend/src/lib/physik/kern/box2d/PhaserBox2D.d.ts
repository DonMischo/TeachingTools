/**
 * Typen für den eingebundenen Box2D-v3-Port (Phaser Box2D 1.1.0, MIT).
 *
 * Das npm-Paket bringt keine Typen mit, deklariert eslint als Laufzeit-
 * abhängigkeit und verweist auf eine `index.js`, die es nicht gibt. Deshalb
 * liegt die eine Datei hier im Quellbaum, und deklariert ist nur, was das
 * Labor tatsächlich benutzt. Wer mehr braucht, ergänzt es hier — nirgends
 * sonst wird Box2D direkt angefasst als in `kern/`.
 */

export class b2Vec2 {
  constructor(x?: number, y?: number);
  x: number;
  y: number;
}
export interface b2Rot { c: number; s: number }

export interface b2WorldId { readonly __welt: unique symbol }
export interface b2BodyId { readonly __koerper: unique symbol }
export interface b2ShapeId { readonly __form: unique symbol }
export interface b2JointId { readonly __gelenk: unique symbol }

export const b2BodyType: { b2_staticBody: number; b2_kinematicBody: number; b2_dynamicBody: number };

export interface b2Filter { categoryBits: number; maskBits: number; groupIndex: number }

export interface b2WorldDef { gravity: b2Vec2; enableSleep: boolean; enableContinuous: boolean }
export interface b2BodyDef {
  type: number; position: b2Vec2; rotation: b2Rot;
  linearVelocity: b2Vec2; angularVelocity: number;
  linearDamping: number; angularDamping: number;
  isBullet: boolean; userData: unknown;
}
export interface b2ShapeDef {
  density: number; friction: number; restitution: number;
  filter: b2Filter; isSensor: boolean;
  enableContactEvents: boolean; enableHitEvents: boolean;
  userData: unknown;
}
export interface b2Polygon { readonly __polygon: unique symbol }
export interface b2Circle { center: b2Vec2; radius: number }
export interface b2Capsule { center1: b2Vec2; center2: b2Vec2; radius: number }

interface GelenkDef { bodyIdA: b2BodyId; bodyIdB: b2BodyId; localAnchorA: b2Vec2; localAnchorB: b2Vec2; collideConnected: boolean; userData: unknown }
export interface b2RevoluteJointDef extends GelenkDef {
  referenceAngle: number;
  enableLimit: boolean; lowerAngle: number; upperAngle: number;
  enableMotor: boolean; maxMotorTorque: number; motorSpeed: number;
  enableSpring: boolean; hertz: number; dampingRatio: number;
}
export interface b2WeldJointDef extends GelenkDef {
  referenceAngle: number; linearHertz: number; angularHertz: number;
  linearDampingRatio: number; angularDampingRatio: number;
}
export interface b2DistanceJointDef extends GelenkDef {
  length: number; minLength: number; maxLength: number;
  enableLimit: boolean; enableSpring: boolean; hertz: number; dampingRatio: number;
  enableMotor: boolean; maxMotorForce: number; motorSpeed: number;
}
export interface b2MouseJointDef {
  bodyIdA: b2BodyId; bodyIdB: b2BodyId; target: b2Vec2;
  hertz: number; dampingRatio: number; maxForce: number; collideConnected: boolean;
}

export interface b2ContactHitEvent {
  shapeIdA: b2ShapeId; shapeIdB: b2ShapeId;
  pointX: number; pointY: number; normalX: number; normalY: number; approachSpeed: number;
}
export interface b2ContactEvents { hitEvents: b2ContactHitEvent[]; hitCount: number }

export function b2CreateWorldArray(): void;
export function b2DefaultWorldDef(): b2WorldDef;
export function b2CreateWorld(def: b2WorldDef): b2WorldId;
export function b2DestroyWorld(id: b2WorldId): void;
export function b2World_Step(id: b2WorldId, dt: number, subSteps: number): void;
export function b2World_IsValid(id: b2WorldId): boolean;
export function b2World_GetContactEvents(id: b2WorldId): b2ContactEvents;
export function b2World_SetHitEventThreshold(id: b2WorldId, speed: number): void;

export function b2DefaultBodyDef(): b2BodyDef;
export function b2CreateBody(welt: b2WorldId, def: b2BodyDef): b2BodyId;
export function b2DestroyBody(id: b2BodyId): void;
export function b2Body_GetPosition(id: b2BodyId): b2Vec2;
export function b2Body_GetRotation(id: b2BodyId): b2Rot;
export function b2Body_GetLinearVelocity(id: b2BodyId): b2Vec2;
export function b2Body_GetAngularVelocity(id: b2BodyId): number;
export function b2Body_SetLinearVelocity(id: b2BodyId, v: b2Vec2): void;
export function b2Body_SetAngularVelocity(id: b2BodyId, w: number): void;
export function b2Body_SetTransform(id: b2BodyId, p: b2Vec2, r: b2Rot): void;
export function b2Body_GetMass(id: b2BodyId): number;
export function b2Body_GetInertiaTensor(id: b2BodyId): number;
export function b2Body_GetWorldCenterOfMass(id: b2BodyId): b2Vec2;
export function b2Body_GetWorldPoint(id: b2BodyId, lokal: b2Vec2): b2Vec2;
export function b2Body_GetLocalPoint(id: b2BodyId, welt: b2Vec2): b2Vec2;
export function b2Body_GetUserData(id: b2BodyId): unknown;
export function b2Body_SetBullet(id: b2BodyId, an: boolean): void;
export function b2Body_SetAwake(id: b2BodyId, an: boolean): void;
export function b2Body_GetType(id: b2BodyId): number;
export function b2Body_ApplyLinearImpulseToCenter(id: b2BodyId, p: b2Vec2, wecken: boolean): void;
export function b2Body_ApplyTorque(id: b2BodyId, moment: number, wecken: boolean): void;

export function b2DefaultShapeDef(): b2ShapeDef;
export function b2MakeBox(hx: number, hy: number): b2Polygon;
/** Box2D 3.0: der Winkel als Zahl, nicht als b2Rot wie ab 3.1. */
export function b2MakeOffsetBox(hx: number, hy: number, mitte: b2Vec2, winkel?: number): b2Polygon;
export function b2MakeRot(winkel: number): b2Rot;
export function b2Rot_GetAngle(r: b2Rot): number;
export function b2CreatePolygonShape(k: b2BodyId, def: b2ShapeDef, p: b2Polygon): b2ShapeId;
export function b2CreateCircleShape(k: b2BodyId, def: b2ShapeDef, c: b2Circle): b2ShapeId;
export function b2CreateCapsuleShape(k: b2BodyId, def: b2ShapeDef, c: b2Capsule): b2ShapeId;
export function b2Shape_GetBody(id: b2ShapeId): b2BodyId;

export function b2DefaultRevoluteJointDef(): b2RevoluteJointDef;
export function b2DefaultWeldJointDef(): b2WeldJointDef;
export function b2DefaultDistanceJointDef(): b2DistanceJointDef;
export function b2DefaultMouseJointDef(): b2MouseJointDef;
export function b2CreateRevoluteJoint(welt: b2WorldId, def: b2RevoluteJointDef): b2JointId;
export function b2CreateWeldJoint(welt: b2WorldId, def: b2WeldJointDef): b2JointId;
export function b2CreateDistanceJoint(welt: b2WorldId, def: b2DistanceJointDef): b2JointId;
export function b2CreateMouseJoint(welt: b2WorldId, def: b2MouseJointDef): b2JointId;
export function b2DestroyJoint(id: b2JointId): void;
export function b2Joint_IsValid(id: b2JointId): boolean;
export function b2Joint_GetConstraintForce(id: b2JointId): b2Vec2;
export function b2Joint_GetConstraintTorque(id: b2JointId): number;
export function b2Joint_WakeBodies(id: b2JointId): void;
export function b2RevoluteJoint_GetAngle(id: b2JointId): number;
export function b2RevoluteJoint_SetMotorSpeed(id: b2JointId, w: number): void;
export function b2RevoluteJoint_EnableMotor(id: b2JointId, an: boolean): void;
export function b2RevoluteJoint_SetMaxMotorTorque(id: b2JointId, m: number): void;
export function b2RevoluteJoint_GetMotorTorque(id: b2JointId): number;
export function b2DistanceJoint_SetLengthRange(id: b2JointId, min: number, max: number): void;
export function b2DistanceJoint_GetCurrentLength(id: b2JointId): number;
export function b2DistanceJoint_SetLength(id: b2JointId, l: number): void;
export function b2MouseJoint_SetTarget(id: b2JointId, ziel: b2Vec2): void;
export function b2RevoluteJoint_IsMotorEnabled(id: b2JointId): boolean;
export function b2RevoluteJoint_GetMotorSpeed(id: b2JointId): number;
export function b2RevoluteJoint_GetMaxMotorTorque(id: b2JointId): number;
