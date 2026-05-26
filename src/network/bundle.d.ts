import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace client. */
export namespace client {

    /** Properties of a JoinRequest. */
    interface IJoinRequest {

        /** JoinRequest nickname */
        nickname?: (string|null);
    }

    /** Represents a JoinRequest. */
    class JoinRequest implements IJoinRequest {

        /**
         * Constructs a new JoinRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: client.IJoinRequest);

        /** JoinRequest nickname. */
        public nickname: string;

        /**
         * Creates a new JoinRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns JoinRequest instance
         */
        public static create(properties?: client.IJoinRequest): client.JoinRequest;

        /**
         * Encodes the specified JoinRequest message. Does not implicitly {@link client.JoinRequest.verify|verify} messages.
         * @param message JoinRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: client.IJoinRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified JoinRequest message, length delimited. Does not implicitly {@link client.JoinRequest.verify|verify} messages.
         * @param message JoinRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: client.IJoinRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a JoinRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns JoinRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): client.JoinRequest;

        /**
         * Decodes a JoinRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns JoinRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): client.JoinRequest;

        /**
         * Verifies a JoinRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a JoinRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns JoinRequest
         */
        public static fromObject(object: { [k: string]: any }): client.JoinRequest;

        /**
         * Creates a plain object from a JoinRequest message. Also converts values to other types if specified.
         * @param message JoinRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: client.JoinRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this JoinRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for JoinRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ClientEnvelope. */
    interface IClientEnvelope {

        /** ClientEnvelope clientInput */
        clientInput?: (client.IClientInput|null);

        /** ClientEnvelope ping */
        ping?: (client.IPing|null);

        /** ClientEnvelope joinRequest */
        joinRequest?: (client.IJoinRequest|null);
    }

    /** Represents a ClientEnvelope. */
    class ClientEnvelope implements IClientEnvelope {

        /**
         * Constructs a new ClientEnvelope.
         * @param [properties] Properties to set
         */
        constructor(properties?: client.IClientEnvelope);

        /** ClientEnvelope clientInput. */
        public clientInput?: (client.IClientInput|null);

        /** ClientEnvelope ping. */
        public ping?: (client.IPing|null);

        /** ClientEnvelope joinRequest. */
        public joinRequest?: (client.IJoinRequest|null);

        /** ClientEnvelope payload. */
        public payload?: ("clientInput"|"ping"|"joinRequest");

        /**
         * Creates a new ClientEnvelope instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClientEnvelope instance
         */
        public static create(properties?: client.IClientEnvelope): client.ClientEnvelope;

        /**
         * Encodes the specified ClientEnvelope message. Does not implicitly {@link client.ClientEnvelope.verify|verify} messages.
         * @param message ClientEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: client.IClientEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ClientEnvelope message, length delimited. Does not implicitly {@link client.ClientEnvelope.verify|verify} messages.
         * @param message ClientEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: client.IClientEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ClientEnvelope message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ClientEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): client.ClientEnvelope;

        /**
         * Decodes a ClientEnvelope message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ClientEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): client.ClientEnvelope;

        /**
         * Verifies a ClientEnvelope message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ClientEnvelope message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ClientEnvelope
         */
        public static fromObject(object: { [k: string]: any }): client.ClientEnvelope;

        /**
         * Creates a plain object from a ClientEnvelope message. Also converts values to other types if specified.
         * @param message ClientEnvelope
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: client.ClientEnvelope, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ClientEnvelope to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ClientEnvelope
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ClientInput. */
    interface IClientInput {

        /** ClientInput actionValue */
        actionValue?: (number|null);
    }

    /** Represents a ClientInput. */
    class ClientInput implements IClientInput {

        /**
         * Constructs a new ClientInput.
         * @param [properties] Properties to set
         */
        constructor(properties?: client.IClientInput);

        /** ClientInput actionValue. */
        public actionValue: number;

        /**
         * Creates a new ClientInput instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClientInput instance
         */
        public static create(properties?: client.IClientInput): client.ClientInput;

        /**
         * Encodes the specified ClientInput message. Does not implicitly {@link client.ClientInput.verify|verify} messages.
         * @param message ClientInput message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: client.IClientInput, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ClientInput message, length delimited. Does not implicitly {@link client.ClientInput.verify|verify} messages.
         * @param message ClientInput message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: client.IClientInput, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ClientInput message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ClientInput
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): client.ClientInput;

        /**
         * Decodes a ClientInput message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ClientInput
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): client.ClientInput;

        /**
         * Verifies a ClientInput message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ClientInput message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ClientInput
         */
        public static fromObject(object: { [k: string]: any }): client.ClientInput;

        /**
         * Creates a plain object from a ClientInput message. Also converts values to other types if specified.
         * @param message ClientInput
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: client.ClientInput, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ClientInput to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ClientInput
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Ping. */
    interface IPing {

        /** Ping clientTimestamp */
        clientTimestamp?: (number|Long|null);

        /** Ping nonce */
        nonce?: (number|null);
    }

    /** Represents a Ping. */
    class Ping implements IPing {

        /**
         * Constructs a new Ping.
         * @param [properties] Properties to set
         */
        constructor(properties?: client.IPing);

        /** Ping clientTimestamp. */
        public clientTimestamp: (number|Long);

        /** Ping nonce. */
        public nonce: number;

        /**
         * Creates a new Ping instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Ping instance
         */
        public static create(properties?: client.IPing): client.Ping;

        /**
         * Encodes the specified Ping message. Does not implicitly {@link client.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: client.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link client.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: client.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): client.Ping;

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): client.Ping;

        /**
         * Verifies a Ping message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Ping
         */
        public static fromObject(object: { [k: string]: any }): client.Ping;

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @param message Ping
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: client.Ping, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Ping to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Ping
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace server. */
export namespace server {

    /** Properties of a NewEntity. */
    interface INewEntity {

        /** NewEntity clientId */
        clientId?: (number|null);

        /** NewEntity name */
        name?: (string|null);

        /** NewEntity x */
        x?: (number|null);

        /** NewEntity y */
        y?: (number|null);

        /** NewEntity angle */
        angle?: (number|null);

        /** NewEntity segmentCount */
        segmentCount?: (number|null);
    }

    /** Represents a NewEntity. */
    class NewEntity implements INewEntity {

        /**
         * Constructs a new NewEntity.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.INewEntity);

        /** NewEntity clientId. */
        public clientId: number;

        /** NewEntity name. */
        public name: string;

        /** NewEntity x. */
        public x: number;

        /** NewEntity y. */
        public y: number;

        /** NewEntity angle. */
        public angle: number;

        /** NewEntity segmentCount. */
        public segmentCount: number;

        /**
         * Creates a new NewEntity instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NewEntity instance
         */
        public static create(properties?: server.INewEntity): server.NewEntity;

        /**
         * Encodes the specified NewEntity message. Does not implicitly {@link server.NewEntity.verify|verify} messages.
         * @param message NewEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.INewEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified NewEntity message, length delimited. Does not implicitly {@link server.NewEntity.verify|verify} messages.
         * @param message NewEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.INewEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NewEntity message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NewEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.NewEntity;

        /**
         * Decodes a NewEntity message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns NewEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.NewEntity;

        /**
         * Verifies a NewEntity message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a NewEntity message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NewEntity
         */
        public static fromObject(object: { [k: string]: any }): server.NewEntity;

        /**
         * Creates a plain object from a NewEntity message. Also converts values to other types if specified.
         * @param message NewEntity
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.NewEntity, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NewEntity to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NewEntity
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Pong. */
    interface IPong {

        /** Pong clientTimestamp */
        clientTimestamp?: (number|Long|null);

        /** Pong serverTimestamp */
        serverTimestamp?: (number|Long|null);

        /** Pong nonce */
        nonce?: (number|null);
    }

    /** Represents a Pong. */
    class Pong implements IPong {

        /**
         * Constructs a new Pong.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IPong);

        /** Pong clientTimestamp. */
        public clientTimestamp: (number|Long);

        /** Pong serverTimestamp. */
        public serverTimestamp: (number|Long);

        /** Pong nonce. */
        public nonce: number;

        /**
         * Creates a new Pong instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Pong instance
         */
        public static create(properties?: server.IPong): server.Pong;

        /**
         * Encodes the specified Pong message. Does not implicitly {@link server.Pong.verify|verify} messages.
         * @param message Pong message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IPong, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Pong message, length delimited. Does not implicitly {@link server.Pong.verify|verify} messages.
         * @param message Pong message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IPong, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Pong message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.Pong;

        /**
         * Decodes a Pong message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.Pong;

        /**
         * Verifies a Pong message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Pong message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Pong
         */
        public static fromObject(object: { [k: string]: any }): server.Pong;

        /**
         * Creates a plain object from a Pong message. Also converts values to other types if specified.
         * @param message Pong
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.Pong, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Pong to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Pong
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a RemoveEntity. */
    interface IRemoveEntity {

        /** RemoveEntity entityId */
        entityId?: (number|null);
    }

    /** Represents a RemoveEntity. */
    class RemoveEntity implements IRemoveEntity {

        /**
         * Constructs a new RemoveEntity.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IRemoveEntity);

        /** RemoveEntity entityId. */
        public entityId: number;

        /**
         * Creates a new RemoveEntity instance using the specified properties.
         * @param [properties] Properties to set
         * @returns RemoveEntity instance
         */
        public static create(properties?: server.IRemoveEntity): server.RemoveEntity;

        /**
         * Encodes the specified RemoveEntity message. Does not implicitly {@link server.RemoveEntity.verify|verify} messages.
         * @param message RemoveEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IRemoveEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified RemoveEntity message, length delimited. Does not implicitly {@link server.RemoveEntity.verify|verify} messages.
         * @param message RemoveEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IRemoveEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a RemoveEntity message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns RemoveEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.RemoveEntity;

        /**
         * Decodes a RemoveEntity message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns RemoveEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.RemoveEntity;

        /**
         * Verifies a RemoveEntity message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a RemoveEntity message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns RemoveEntity
         */
        public static fromObject(object: { [k: string]: any }): server.RemoveEntity;

        /**
         * Creates a plain object from a RemoveEntity message. Also converts values to other types if specified.
         * @param message RemoveEntity
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.RemoveEntity, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this RemoveEntity to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for RemoveEntity
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ServerEnvelope. */
    interface IServerEnvelope {

        /** ServerEnvelope startInformation */
        startInformation?: (server.IStartInformation|null);

        /** ServerEnvelope entityCollection */
        entityCollection?: (server.IEntityCollection|null);

        /** ServerEnvelope removeEntity */
        removeEntity?: (server.IRemoveEntity|null);

        /** ServerEnvelope pong */
        pong?: (server.IPong|null);

        /** ServerEnvelope deathNotification */
        deathNotification?: (server.IDeathNotification|null);

        /** ServerEnvelope selfPosition */
        selfPosition?: (server.ISelfPosition|null);

        /** ServerEnvelope segmentMutationCollection */
        segmentMutationCollection?: (server.ISegmentMutationCollection|null);

        /** ServerEnvelope foodCollection */
        foodCollection?: (server.IFoodCollection|null);

        /** ServerEnvelope foodMutationCollection */
        foodMutationCollection?: (server.IFoodMutationCollection|null);
    }

    /** Represents a ServerEnvelope. */
    class ServerEnvelope implements IServerEnvelope {

        /**
         * Constructs a new ServerEnvelope.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IServerEnvelope);

        /** ServerEnvelope startInformation. */
        public startInformation?: (server.IStartInformation|null);

        /** ServerEnvelope entityCollection. */
        public entityCollection?: (server.IEntityCollection|null);

        /** ServerEnvelope removeEntity. */
        public removeEntity?: (server.IRemoveEntity|null);

        /** ServerEnvelope pong. */
        public pong?: (server.IPong|null);

        /** ServerEnvelope deathNotification. */
        public deathNotification?: (server.IDeathNotification|null);

        /** ServerEnvelope selfPosition. */
        public selfPosition?: (server.ISelfPosition|null);

        /** ServerEnvelope segmentMutationCollection. */
        public segmentMutationCollection?: (server.ISegmentMutationCollection|null);

        /** ServerEnvelope foodCollection. */
        public foodCollection?: (server.IFoodCollection|null);

        /** ServerEnvelope foodMutationCollection. */
        public foodMutationCollection?: (server.IFoodMutationCollection|null);

        /** ServerEnvelope payload. */
        public payload?: ("startInformation"|"entityCollection"|"removeEntity"|"pong"|"deathNotification");

        /**
         * Creates a new ServerEnvelope instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ServerEnvelope instance
         */
        public static create(properties?: server.IServerEnvelope): server.ServerEnvelope;

        /**
         * Encodes the specified ServerEnvelope message. Does not implicitly {@link server.ServerEnvelope.verify|verify} messages.
         * @param message ServerEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IServerEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ServerEnvelope message, length delimited. Does not implicitly {@link server.ServerEnvelope.verify|verify} messages.
         * @param message ServerEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IServerEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ServerEnvelope message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ServerEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.ServerEnvelope;

        /**
         * Decodes a ServerEnvelope message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ServerEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.ServerEnvelope;

        /**
         * Verifies a ServerEnvelope message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ServerEnvelope message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ServerEnvelope
         */
        public static fromObject(object: { [k: string]: any }): server.ServerEnvelope;

        /**
         * Creates a plain object from a ServerEnvelope message. Also converts values to other types if specified.
         * @param message ServerEnvelope
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.ServerEnvelope, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ServerEnvelope to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ServerEnvelope
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a StartInformation. */
    interface IStartInformation {

        /** StartInformation clientId */
        clientId?: (number|null);

        /** StartInformation x */
        x?: (number|null);

        /** StartInformation y */
        y?: (number|null);

        /** StartInformation segmentCount */
        segmentCount?: (number|null);

        /** StartInformation startDirection */
        startDirection?: (number|null);

        /** StartInformation scale */
        scale?: (number|null);

        /** StartInformation worldRadius */
        worldRadius?: (number|null);
    }

    /** Represents a StartInformation. */
    class StartInformation implements IStartInformation {

        /**
         * Constructs a new StartInformation.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IStartInformation);

        /** StartInformation clientId. */
        public clientId: number;

        /** StartInformation x. */
        public x: number;

        /** StartInformation y. */
        public y: number;

        /** StartInformation segmentCount. */
        public segmentCount: number;

        /** StartInformation startDirection. */
        public startDirection: number;

        /** StartInformation scale. */
        public scale: number;

        /** StartInformation worldRadius. */
        public worldRadius: number;

        /**
         * Creates a new StartInformation instance using the specified properties.
         * @param [properties] Properties to set
         * @returns StartInformation instance
         */
        public static create(properties?: server.IStartInformation): server.StartInformation;

        /**
         * Encodes the specified StartInformation message. Does not implicitly {@link server.StartInformation.verify|verify} messages.
         * @param message StartInformation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IStartInformation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified StartInformation message, length delimited. Does not implicitly {@link server.StartInformation.verify|verify} messages.
         * @param message StartInformation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IStartInformation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a StartInformation message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns StartInformation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.StartInformation;

        /**
         * Decodes a StartInformation message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns StartInformation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.StartInformation;

        /**
         * Verifies a StartInformation message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a StartInformation message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns StartInformation
         */
        public static fromObject(object: { [k: string]: any }): server.StartInformation;

        /**
         * Creates a plain object from a StartInformation message. Also converts values to other types if specified.
         * @param message StartInformation
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.StartInformation, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this StartInformation to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for StartInformation
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UpdateEntity. */
    interface IUpdateEntity {

        /** UpdateEntity entityId */
        entityId?: (number|null);

        /** UpdateEntity x */
        x?: (number|null);

        /** UpdateEntity y */
        y?: (number|null);

        /** UpdateEntity angle */
        angle?: (number|null);

        /** UpdateEntity segmentCount */
        segmentCount?: (number|null);
    }

    /** Represents an UpdateEntity. */
    class UpdateEntity implements IUpdateEntity {

        /**
         * Constructs a new UpdateEntity.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IUpdateEntity);

        /** UpdateEntity entityId. */
        public entityId: number;

        /** UpdateEntity x. */
        public x: number;

        /** UpdateEntity y. */
        public y: number;

        /** UpdateEntity angle. */
        public angle: number;

        /** UpdateEntity segmentCount. */
        public segmentCount: number;

        /**
         * Creates a new UpdateEntity instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UpdateEntity instance
         */
        public static create(properties?: server.IUpdateEntity): server.UpdateEntity;

        /**
         * Encodes the specified UpdateEntity message. Does not implicitly {@link server.UpdateEntity.verify|verify} messages.
         * @param message UpdateEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IUpdateEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UpdateEntity message, length delimited. Does not implicitly {@link server.UpdateEntity.verify|verify} messages.
         * @param message UpdateEntity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IUpdateEntity, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an UpdateEntity message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UpdateEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.UpdateEntity;

        /**
         * Decodes an UpdateEntity message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UpdateEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.UpdateEntity;

        /**
         * Verifies an UpdateEntity message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an UpdateEntity message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UpdateEntity
         */
        public static fromObject(object: { [k: string]: any }): server.UpdateEntity;

        /**
         * Creates a plain object from an UpdateEntity message. Also converts values to other types if specified.
         * @param message UpdateEntity
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.UpdateEntity, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UpdateEntity to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UpdateEntity
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an EntityCollection. */
    interface IEntityCollection {

        /** EntityCollection entityIds */
        entityIds?: (number[]|null);

        /** EntityCollection xs */
        xs?: (number[]|null);

        /** EntityCollection ys */
        ys?: (number[]|null);

        /** EntityCollection angles */
        angles?: (number[]|null);

        /** EntityCollection fullyDataEntityIds */
        fullyDataEntityIds?: (number[]|null);

        /** EntityCollection fullyDataSegmentCounts */
        fullyDataSegmentCounts?: (number[]|null);

        /** EntityCollection scales */
        scales?: (number[]|null);

        /** EntityCollection fullyDataNicknames */
        fullyDataNicknames?: (string[]|null);
    }

    /** Represents an EntityCollection. */
    class EntityCollection implements IEntityCollection {

        /**
         * Constructs a new EntityCollection.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IEntityCollection);

        /** EntityCollection entityIds. */
        public entityIds: number[];

        /** EntityCollection xs. */
        public xs: number[];

        /** EntityCollection ys. */
        public ys: number[];

        /** EntityCollection angles. */
        public angles: number[];

        /** EntityCollection fullyDataEntityIds. */
        public fullyDataEntityIds: number[];

        /** EntityCollection fullyDataSegmentCounts. */
        public fullyDataSegmentCounts: number[];

        /** EntityCollection scales. */
        public scales: number[];

        /** EntityCollection fullyDataNicknames. */
        public fullyDataNicknames: string[];

        /**
         * Creates a new EntityCollection instance using the specified properties.
         * @param [properties] Properties to set
         * @returns EntityCollection instance
         */
        public static create(properties?: server.IEntityCollection): server.EntityCollection;

        /**
         * Encodes the specified EntityCollection message. Does not implicitly {@link server.EntityCollection.verify|verify} messages.
         * @param message EntityCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IEntityCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified EntityCollection message, length delimited. Does not implicitly {@link server.EntityCollection.verify|verify} messages.
         * @param message EntityCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IEntityCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an EntityCollection message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns EntityCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.EntityCollection;

        /**
         * Decodes an EntityCollection message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns EntityCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.EntityCollection;

        /**
         * Verifies an EntityCollection message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an EntityCollection message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns EntityCollection
         */
        public static fromObject(object: { [k: string]: any }): server.EntityCollection;

        /**
         * Creates a plain object from an EntityCollection message. Also converts values to other types if specified.
         * @param message EntityCollection
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.EntityCollection, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this EntityCollection to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for EntityCollection
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an EntityFull. */
    interface IEntityFull {

        /** EntityFull entityId */
        entityId?: (number|null);

        /** EntityFull x */
        x?: (number|null);

        /** EntityFull y */
        y?: (number|null);

        /** EntityFull angle */
        angle?: (number|null);

        /** EntityFull segmentCount */
        segmentCount?: (number|null);
    }

    /** Represents an EntityFull. */
    class EntityFull implements IEntityFull {

        /**
         * Constructs a new EntityFull.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IEntityFull);

        /** EntityFull entityId. */
        public entityId: number;

        /** EntityFull x. */
        public x: number;

        /** EntityFull y. */
        public y: number;

        /** EntityFull angle. */
        public angle: number;

        /** EntityFull segmentCount. */
        public segmentCount: number;

        /**
         * Creates a new EntityFull instance using the specified properties.
         * @param [properties] Properties to set
         * @returns EntityFull instance
         */
        public static create(properties?: server.IEntityFull): server.EntityFull;

        /**
         * Encodes the specified EntityFull message. Does not implicitly {@link server.EntityFull.verify|verify} messages.
         * @param message EntityFull message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IEntityFull, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified EntityFull message, length delimited. Does not implicitly {@link server.EntityFull.verify|verify} messages.
         * @param message EntityFull message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IEntityFull, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an EntityFull message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns EntityFull
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.EntityFull;

        /**
         * Decodes an EntityFull message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns EntityFull
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.EntityFull;

        /**
         * Verifies an EntityFull message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an EntityFull message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns EntityFull
         */
        public static fromObject(object: { [k: string]: any }): server.EntityFull;

        /**
         * Creates a plain object from an EntityFull message. Also converts values to other types if specified.
         * @param message EntityFull
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.EntityFull, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this EntityFull to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for EntityFull
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SelfPosition. */
    interface ISelfPosition {

        /** SelfPosition entityId */
        entityId?: (number|null);

        /** SelfPosition x */
        x?: (number|null);

        /** SelfPosition y */
        y?: (number|null);

        /** SelfPosition scale */
        scale?: (number|null);
    }

    /** Represents a SelfPosition. */
    class SelfPosition implements ISelfPosition {

        /**
         * Constructs a new SelfPosition.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.ISelfPosition);

        /** SelfPosition entityId. */
        public entityId: number;

        /** SelfPosition x. */
        public x: number;

        /** SelfPosition y. */
        public y: number;

        /** SelfPosition scale. */
        public scale: number;

        /**
         * Creates a new SelfPosition instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SelfPosition instance
         */
        public static create(properties?: server.ISelfPosition): server.SelfPosition;

        /**
         * Encodes the specified SelfPosition message. Does not implicitly {@link server.SelfPosition.verify|verify} messages.
         * @param message SelfPosition message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.ISelfPosition, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SelfPosition message, length delimited. Does not implicitly {@link server.SelfPosition.verify|verify} messages.
         * @param message SelfPosition message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.ISelfPosition, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SelfPosition message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SelfPosition
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.SelfPosition;

        /**
         * Decodes a SelfPosition message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SelfPosition
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.SelfPosition;

        /**
         * Verifies a SelfPosition message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SelfPosition message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SelfPosition
         */
        public static fromObject(object: { [k: string]: any }): server.SelfPosition;

        /**
         * Creates a plain object from a SelfPosition message. Also converts values to other types if specified.
         * @param message SelfPosition
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.SelfPosition, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SelfPosition to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SelfPosition
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SegmentMutationCollection. */
    interface ISegmentMutationCollection {

        /** SegmentMutationCollection mutations */
        mutations?: (server.ISegmentMutation[]|null);
    }

    /** Represents a SegmentMutationCollection. */
    class SegmentMutationCollection implements ISegmentMutationCollection {

        /**
         * Constructs a new SegmentMutationCollection.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.ISegmentMutationCollection);

        /** SegmentMutationCollection mutations. */
        public mutations: server.ISegmentMutation[];

        /**
         * Creates a new SegmentMutationCollection instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SegmentMutationCollection instance
         */
        public static create(properties?: server.ISegmentMutationCollection): server.SegmentMutationCollection;

        /**
         * Encodes the specified SegmentMutationCollection message. Does not implicitly {@link server.SegmentMutationCollection.verify|verify} messages.
         * @param message SegmentMutationCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.ISegmentMutationCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SegmentMutationCollection message, length delimited. Does not implicitly {@link server.SegmentMutationCollection.verify|verify} messages.
         * @param message SegmentMutationCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.ISegmentMutationCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SegmentMutationCollection message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SegmentMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.SegmentMutationCollection;

        /**
         * Decodes a SegmentMutationCollection message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SegmentMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.SegmentMutationCollection;

        /**
         * Verifies a SegmentMutationCollection message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SegmentMutationCollection message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SegmentMutationCollection
         */
        public static fromObject(object: { [k: string]: any }): server.SegmentMutationCollection;

        /**
         * Creates a plain object from a SegmentMutationCollection message. Also converts values to other types if specified.
         * @param message SegmentMutationCollection
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.SegmentMutationCollection, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SegmentMutationCollection to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SegmentMutationCollection
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SegmentMutation. */
    interface ISegmentMutation {

        /** SegmentMutation entityId */
        entityId?: (number|null);

        /** SegmentMutation mutationType */
        mutationType?: (server.SegmentMutation.MutationType|null);

        /** SegmentMutation addedSegmentCount */
        addedSegmentCount?: (number|null);

        /** SegmentMutation removedSegmentCount */
        removedSegmentCount?: (number|null);
    }

    /** Represents a SegmentMutation. */
    class SegmentMutation implements ISegmentMutation {

        /**
         * Constructs a new SegmentMutation.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.ISegmentMutation);

        /** SegmentMutation entityId. */
        public entityId: number;

        /** SegmentMutation mutationType. */
        public mutationType: server.SegmentMutation.MutationType;

        /** SegmentMutation addedSegmentCount. */
        public addedSegmentCount: number;

        /** SegmentMutation removedSegmentCount. */
        public removedSegmentCount: number;

        /**
         * Creates a new SegmentMutation instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SegmentMutation instance
         */
        public static create(properties?: server.ISegmentMutation): server.SegmentMutation;

        /**
         * Encodes the specified SegmentMutation message. Does not implicitly {@link server.SegmentMutation.verify|verify} messages.
         * @param message SegmentMutation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.ISegmentMutation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SegmentMutation message, length delimited. Does not implicitly {@link server.SegmentMutation.verify|verify} messages.
         * @param message SegmentMutation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.ISegmentMutation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SegmentMutation message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SegmentMutation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.SegmentMutation;

        /**
         * Decodes a SegmentMutation message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SegmentMutation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.SegmentMutation;

        /**
         * Verifies a SegmentMutation message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SegmentMutation message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SegmentMutation
         */
        public static fromObject(object: { [k: string]: any }): server.SegmentMutation;

        /**
         * Creates a plain object from a SegmentMutation message. Also converts values to other types if specified.
         * @param message SegmentMutation
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.SegmentMutation, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SegmentMutation to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SegmentMutation
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace SegmentMutation {

        /** MutationType enum. */
        enum MutationType {
            SEGMENT_ADD = 0,
            SEGMENT_REMOVE = 1
        }
    }

    /** Properties of a FoodData. */
    interface IFoodData {

        /** FoodData foodId */
        foodId?: (number|null);

        /** FoodData x */
        x?: (number|null);

        /** FoodData y */
        y?: (number|null);
    }

    /** Represents a FoodData. */
    class FoodData implements IFoodData {

        /**
         * Constructs a new FoodData.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IFoodData);

        /** FoodData foodId. */
        public foodId: number;

        /** FoodData x. */
        public x: number;

        /** FoodData y. */
        public y: number;

        /**
         * Creates a new FoodData instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FoodData instance
         */
        public static create(properties?: server.IFoodData): server.FoodData;

        /**
         * Encodes the specified FoodData message. Does not implicitly {@link server.FoodData.verify|verify} messages.
         * @param message FoodData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IFoodData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FoodData message, length delimited. Does not implicitly {@link server.FoodData.verify|verify} messages.
         * @param message FoodData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IFoodData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FoodData message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FoodData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.FoodData;

        /**
         * Decodes a FoodData message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FoodData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.FoodData;

        /**
         * Verifies a FoodData message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FoodData message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FoodData
         */
        public static fromObject(object: { [k: string]: any }): server.FoodData;

        /**
         * Creates a plain object from a FoodData message. Also converts values to other types if specified.
         * @param message FoodData
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.FoodData, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FoodData to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FoodData
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FoodCollection. */
    interface IFoodCollection {

        /** FoodCollection foods */
        foods?: (server.IFoodData[]|null);
    }

    /** Represents a FoodCollection. */
    class FoodCollection implements IFoodCollection {

        /**
         * Constructs a new FoodCollection.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IFoodCollection);

        /** FoodCollection foods. */
        public foods: server.IFoodData[];

        /**
         * Creates a new FoodCollection instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FoodCollection instance
         */
        public static create(properties?: server.IFoodCollection): server.FoodCollection;

        /**
         * Encodes the specified FoodCollection message. Does not implicitly {@link server.FoodCollection.verify|verify} messages.
         * @param message FoodCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IFoodCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FoodCollection message, length delimited. Does not implicitly {@link server.FoodCollection.verify|verify} messages.
         * @param message FoodCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IFoodCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FoodCollection message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FoodCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.FoodCollection;

        /**
         * Decodes a FoodCollection message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FoodCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.FoodCollection;

        /**
         * Verifies a FoodCollection message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FoodCollection message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FoodCollection
         */
        public static fromObject(object: { [k: string]: any }): server.FoodCollection;

        /**
         * Creates a plain object from a FoodCollection message. Also converts values to other types if specified.
         * @param message FoodCollection
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.FoodCollection, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FoodCollection to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FoodCollection
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FoodMutationCollection. */
    interface IFoodMutationCollection {

        /** FoodMutationCollection addedFoods */
        addedFoods?: (server.IFoodData[]|null);

        /** FoodMutationCollection removedFoodIds */
        removedFoodIds?: (number[]|null);
    }

    /** Represents a FoodMutationCollection. */
    class FoodMutationCollection implements IFoodMutationCollection {

        /**
         * Constructs a new FoodMutationCollection.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IFoodMutationCollection);

        /** FoodMutationCollection addedFoods. */
        public addedFoods: server.IFoodData[];

        /** FoodMutationCollection removedFoodIds. */
        public removedFoodIds: number[];

        /**
         * Creates a new FoodMutationCollection instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FoodMutationCollection instance
         */
        public static create(properties?: server.IFoodMutationCollection): server.FoodMutationCollection;

        /**
         * Encodes the specified FoodMutationCollection message. Does not implicitly {@link server.FoodMutationCollection.verify|verify} messages.
         * @param message FoodMutationCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IFoodMutationCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FoodMutationCollection message, length delimited. Does not implicitly {@link server.FoodMutationCollection.verify|verify} messages.
         * @param message FoodMutationCollection message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IFoodMutationCollection, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FoodMutationCollection message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FoodMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.FoodMutationCollection;

        /**
         * Decodes a FoodMutationCollection message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FoodMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.FoodMutationCollection;

        /**
         * Verifies a FoodMutationCollection message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FoodMutationCollection message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FoodMutationCollection
         */
        public static fromObject(object: { [k: string]: any }): server.FoodMutationCollection;

        /**
         * Creates a plain object from a FoodMutationCollection message. Also converts values to other types if specified.
         * @param message FoodMutationCollection
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.FoodMutationCollection, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FoodMutationCollection to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FoodMutationCollection
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DeathNotification. */
    interface IDeathNotification {

        /** DeathNotification score */
        score?: (number|null);

        /** DeathNotification killedByEntityId */
        killedByEntityId?: (number|null);
    }

    /** Represents a DeathNotification. */
    class DeathNotification implements IDeathNotification {

        /**
         * Constructs a new DeathNotification.
         * @param [properties] Properties to set
         */
        constructor(properties?: server.IDeathNotification);

        /** DeathNotification score. */
        public score: number;

        /** DeathNotification killedByEntityId. */
        public killedByEntityId: number;

        /**
         * Creates a new DeathNotification instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DeathNotification instance
         */
        public static create(properties?: server.IDeathNotification): server.DeathNotification;

        /**
         * Encodes the specified DeathNotification message. Does not implicitly {@link server.DeathNotification.verify|verify} messages.
         * @param message DeathNotification message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: server.IDeathNotification, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified DeathNotification message, length delimited. Does not implicitly {@link server.DeathNotification.verify|verify} messages.
         * @param message DeathNotification message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: server.IDeathNotification, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a DeathNotification message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DeathNotification
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): server.DeathNotification;

        /**
         * Decodes a DeathNotification message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DeathNotification
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): server.DeathNotification;

        /**
         * Verifies a DeathNotification message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a DeathNotification message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DeathNotification
         */
        public static fromObject(object: { [k: string]: any }): server.DeathNotification;

        /**
         * Creates a plain object from a DeathNotification message. Also converts values to other types if specified.
         * @param message DeathNotification
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: server.DeathNotification, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this DeathNotification to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DeathNotification
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
