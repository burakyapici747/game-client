/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const client = $root.client = (() => {

    /**
     * Namespace client.
     * @exports client
     * @namespace
     */
    const client = {};

    client.ClientEnvelope = (function() {

        /**
         * Properties of a ClientEnvelope.
         * @memberof client
         * @interface IClientEnvelope
         * @property {client.IClientInput|null} [clientInput] ClientEnvelope clientInput
         * @property {client.IPing|null} [ping] ClientEnvelope ping
         */

        /**
         * Constructs a new ClientEnvelope.
         * @memberof client
         * @classdesc Represents a ClientEnvelope.
         * @implements IClientEnvelope
         * @constructor
         * @param {client.IClientEnvelope=} [properties] Properties to set
         */
        function ClientEnvelope(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientEnvelope clientInput.
         * @member {client.IClientInput|null|undefined} clientInput
         * @memberof client.ClientEnvelope
         * @instance
         */
        ClientEnvelope.prototype.clientInput = null;

        /**
         * ClientEnvelope ping.
         * @member {client.IPing|null|undefined} ping
         * @memberof client.ClientEnvelope
         * @instance
         */
        ClientEnvelope.prototype.ping = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * ClientEnvelope payload.
         * @member {"clientInput"|"ping"|undefined} payload
         * @memberof client.ClientEnvelope
         * @instance
         */
        Object.defineProperty(ClientEnvelope.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["clientInput", "ping"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ClientEnvelope instance using the specified properties.
         * @function create
         * @memberof client.ClientEnvelope
         * @static
         * @param {client.IClientEnvelope=} [properties] Properties to set
         * @returns {client.ClientEnvelope} ClientEnvelope instance
         */
        ClientEnvelope.create = function create(properties) {
            return new ClientEnvelope(properties);
        };

        /**
         * Encodes the specified ClientEnvelope message. Does not implicitly {@link client.ClientEnvelope.verify|verify} messages.
         * @function encode
         * @memberof client.ClientEnvelope
         * @static
         * @param {client.IClientEnvelope} message ClientEnvelope message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientEnvelope.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientInput != null && Object.hasOwnProperty.call(message, "clientInput"))
                $root.client.ClientInput.encode(message.clientInput, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.ping != null && Object.hasOwnProperty.call(message, "ping"))
                $root.client.Ping.encode(message.ping, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ClientEnvelope message, length delimited. Does not implicitly {@link client.ClientEnvelope.verify|verify} messages.
         * @function encodeDelimited
         * @memberof client.ClientEnvelope
         * @static
         * @param {client.IClientEnvelope} message ClientEnvelope message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientEnvelope.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientEnvelope message from the specified reader or buffer.
         * @function decode
         * @memberof client.ClientEnvelope
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {client.ClientEnvelope} ClientEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientEnvelope.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.client.ClientEnvelope();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.clientInput = $root.client.ClientInput.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.ping = $root.client.Ping.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientEnvelope message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof client.ClientEnvelope
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {client.ClientEnvelope} ClientEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientEnvelope.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientEnvelope message.
         * @function verify
         * @memberof client.ClientEnvelope
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientEnvelope.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.clientInput != null && message.hasOwnProperty("clientInput")) {
                properties.payload = 1;
                {
                    let error = $root.client.ClientInput.verify(message.clientInput);
                    if (error)
                        return "clientInput." + error;
                }
            }
            if (message.ping != null && message.hasOwnProperty("ping")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.client.Ping.verify(message.ping);
                    if (error)
                        return "ping." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ClientEnvelope message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof client.ClientEnvelope
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {client.ClientEnvelope} ClientEnvelope
         */
        ClientEnvelope.fromObject = function fromObject(object) {
            if (object instanceof $root.client.ClientEnvelope)
                return object;
            let message = new $root.client.ClientEnvelope();
            if (object.clientInput != null) {
                if (typeof object.clientInput !== "object")
                    throw TypeError(".client.ClientEnvelope.clientInput: object expected");
                message.clientInput = $root.client.ClientInput.fromObject(object.clientInput);
            }
            if (object.ping != null) {
                if (typeof object.ping !== "object")
                    throw TypeError(".client.ClientEnvelope.ping: object expected");
                message.ping = $root.client.Ping.fromObject(object.ping);
            }
            return message;
        };

        /**
         * Creates a plain object from a ClientEnvelope message. Also converts values to other types if specified.
         * @function toObject
         * @memberof client.ClientEnvelope
         * @static
         * @param {client.ClientEnvelope} message ClientEnvelope
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientEnvelope.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.clientInput != null && message.hasOwnProperty("clientInput")) {
                object.clientInput = $root.client.ClientInput.toObject(message.clientInput, options);
                if (options.oneofs)
                    object.payload = "clientInput";
            }
            if (message.ping != null && message.hasOwnProperty("ping")) {
                object.ping = $root.client.Ping.toObject(message.ping, options);
                if (options.oneofs)
                    object.payload = "ping";
            }
            return object;
        };

        /**
         * Converts this ClientEnvelope to JSON.
         * @function toJSON
         * @memberof client.ClientEnvelope
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientEnvelope.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientEnvelope
         * @function getTypeUrl
         * @memberof client.ClientEnvelope
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientEnvelope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/client.ClientEnvelope";
        };

        return ClientEnvelope;
    })();

    client.ClientInput = (function() {

        /**
         * Properties of a ClientInput.
         * @memberof client
         * @interface IClientInput
         * @property {number|null} [actionValue] ClientInput actionValue
         */

        /**
         * Constructs a new ClientInput.
         * @memberof client
         * @classdesc Represents a ClientInput.
         * @implements IClientInput
         * @constructor
         * @param {client.IClientInput=} [properties] Properties to set
         */
        function ClientInput(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ClientInput actionValue.
         * @member {number} actionValue
         * @memberof client.ClientInput
         * @instance
         */
        ClientInput.prototype.actionValue = 0;

        /**
         * Creates a new ClientInput instance using the specified properties.
         * @function create
         * @memberof client.ClientInput
         * @static
         * @param {client.IClientInput=} [properties] Properties to set
         * @returns {client.ClientInput} ClientInput instance
         */
        ClientInput.create = function create(properties) {
            return new ClientInput(properties);
        };

        /**
         * Encodes the specified ClientInput message. Does not implicitly {@link client.ClientInput.verify|verify} messages.
         * @function encode
         * @memberof client.ClientInput
         * @static
         * @param {client.IClientInput} message ClientInput message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientInput.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.actionValue != null && Object.hasOwnProperty.call(message, "actionValue"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.actionValue);
            return writer;
        };

        /**
         * Encodes the specified ClientInput message, length delimited. Does not implicitly {@link client.ClientInput.verify|verify} messages.
         * @function encodeDelimited
         * @memberof client.ClientInput
         * @static
         * @param {client.IClientInput} message ClientInput message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ClientInput.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ClientInput message from the specified reader or buffer.
         * @function decode
         * @memberof client.ClientInput
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {client.ClientInput} ClientInput
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientInput.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.client.ClientInput();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.actionValue = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ClientInput message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof client.ClientInput
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {client.ClientInput} ClientInput
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ClientInput.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ClientInput message.
         * @function verify
         * @memberof client.ClientInput
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ClientInput.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.actionValue != null && message.hasOwnProperty("actionValue"))
                if (!$util.isInteger(message.actionValue))
                    return "actionValue: integer expected";
            return null;
        };

        /**
         * Creates a ClientInput message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof client.ClientInput
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {client.ClientInput} ClientInput
         */
        ClientInput.fromObject = function fromObject(object) {
            if (object instanceof $root.client.ClientInput)
                return object;
            let message = new $root.client.ClientInput();
            if (object.actionValue != null)
                message.actionValue = object.actionValue >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ClientInput message. Also converts values to other types if specified.
         * @function toObject
         * @memberof client.ClientInput
         * @static
         * @param {client.ClientInput} message ClientInput
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ClientInput.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults)
                object.actionValue = 0;
            if (message.actionValue != null && message.hasOwnProperty("actionValue"))
                object.actionValue = message.actionValue;
            return object;
        };

        /**
         * Converts this ClientInput to JSON.
         * @function toJSON
         * @memberof client.ClientInput
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ClientInput.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ClientInput
         * @function getTypeUrl
         * @memberof client.ClientInput
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ClientInput.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/client.ClientInput";
        };

        return ClientInput;
    })();

    client.Ping = (function() {

        /**
         * Properties of a Ping.
         * @memberof client
         * @interface IPing
         * @property {number|Long|null} [clientTimestamp] Ping clientTimestamp
         * @property {number|null} [nonce] Ping nonce
         */

        /**
         * Constructs a new Ping.
         * @memberof client
         * @classdesc Represents a Ping.
         * @implements IPing
         * @constructor
         * @param {client.IPing=} [properties] Properties to set
         */
        function Ping(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Ping clientTimestamp.
         * @member {number|Long} clientTimestamp
         * @memberof client.Ping
         * @instance
         */
        Ping.prototype.clientTimestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Ping nonce.
         * @member {number} nonce
         * @memberof client.Ping
         * @instance
         */
        Ping.prototype.nonce = 0;

        /**
         * Creates a new Ping instance using the specified properties.
         * @function create
         * @memberof client.Ping
         * @static
         * @param {client.IPing=} [properties] Properties to set
         * @returns {client.Ping} Ping instance
         */
        Ping.create = function create(properties) {
            return new Ping(properties);
        };

        /**
         * Encodes the specified Ping message. Does not implicitly {@link client.Ping.verify|verify} messages.
         * @function encode
         * @memberof client.Ping
         * @static
         * @param {client.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientTimestamp != null && Object.hasOwnProperty.call(message, "clientTimestamp"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.clientTimestamp);
            if (message.nonce != null && Object.hasOwnProperty.call(message, "nonce"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.nonce);
            return writer;
        };

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link client.Ping.verify|verify} messages.
         * @function encodeDelimited
         * @memberof client.Ping
         * @static
         * @param {client.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @function decode
         * @memberof client.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {client.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.client.Ping();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.clientTimestamp = reader.uint64();
                        break;
                    }
                case 2: {
                        message.nonce = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof client.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {client.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Ping message.
         * @function verify
         * @memberof client.Ping
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Ping.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (!$util.isInteger(message.clientTimestamp) && !(message.clientTimestamp && $util.isInteger(message.clientTimestamp.low) && $util.isInteger(message.clientTimestamp.high)))
                    return "clientTimestamp: integer|Long expected";
            if (message.nonce != null && message.hasOwnProperty("nonce"))
                if (!$util.isInteger(message.nonce))
                    return "nonce: integer expected";
            return null;
        };

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof client.Ping
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {client.Ping} Ping
         */
        Ping.fromObject = function fromObject(object) {
            if (object instanceof $root.client.Ping)
                return object;
            let message = new $root.client.Ping();
            if (object.clientTimestamp != null)
                if ($util.Long)
                    (message.clientTimestamp = $util.Long.fromValue(object.clientTimestamp)).unsigned = true;
                else if (typeof object.clientTimestamp === "string")
                    message.clientTimestamp = parseInt(object.clientTimestamp, 10);
                else if (typeof object.clientTimestamp === "number")
                    message.clientTimestamp = object.clientTimestamp;
                else if (typeof object.clientTimestamp === "object")
                    message.clientTimestamp = new $util.LongBits(object.clientTimestamp.low >>> 0, object.clientTimestamp.high >>> 0).toNumber(true);
            if (object.nonce != null)
                message.nonce = object.nonce >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @function toObject
         * @memberof client.Ping
         * @static
         * @param {client.Ping} message Ping
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Ping.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.clientTimestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.clientTimestamp = options.longs === String ? "0" : 0;
                object.nonce = 0;
            }
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (typeof message.clientTimestamp === "number")
                    object.clientTimestamp = options.longs === String ? String(message.clientTimestamp) : message.clientTimestamp;
                else
                    object.clientTimestamp = options.longs === String ? $util.Long.prototype.toString.call(message.clientTimestamp) : options.longs === Number ? new $util.LongBits(message.clientTimestamp.low >>> 0, message.clientTimestamp.high >>> 0).toNumber(true) : message.clientTimestamp;
            if (message.nonce != null && message.hasOwnProperty("nonce"))
                object.nonce = message.nonce;
            return object;
        };

        /**
         * Converts this Ping to JSON.
         * @function toJSON
         * @memberof client.Ping
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Ping.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Ping
         * @function getTypeUrl
         * @memberof client.Ping
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Ping.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/client.Ping";
        };

        return Ping;
    })();

    return client;
})();

export const server = $root.server = (() => {

    /**
     * Namespace server.
     * @exports server
     * @namespace
     */
    const server = {};

    server.NewEntity = (function() {

        /**
         * Properties of a NewEntity.
         * @memberof server
         * @interface INewEntity
         * @property {number|null} [clientId] NewEntity clientId
         * @property {string|null} [name] NewEntity name
         * @property {number|null} [x] NewEntity x
         * @property {number|null} [y] NewEntity y
         * @property {number|null} [angle] NewEntity angle
         * @property {number|null} [segmentCount] NewEntity segmentCount
         */

        /**
         * Constructs a new NewEntity.
         * @memberof server
         * @classdesc Represents a NewEntity.
         * @implements INewEntity
         * @constructor
         * @param {server.INewEntity=} [properties] Properties to set
         */
        function NewEntity(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NewEntity clientId.
         * @member {number} clientId
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.clientId = 0;

        /**
         * NewEntity name.
         * @member {string} name
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.name = "";

        /**
         * NewEntity x.
         * @member {number} x
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.x = 0;

        /**
         * NewEntity y.
         * @member {number} y
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.y = 0;

        /**
         * NewEntity angle.
         * @member {number} angle
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.angle = 0;

        /**
         * NewEntity segmentCount.
         * @member {number} segmentCount
         * @memberof server.NewEntity
         * @instance
         */
        NewEntity.prototype.segmentCount = 0;

        /**
         * Creates a new NewEntity instance using the specified properties.
         * @function create
         * @memberof server.NewEntity
         * @static
         * @param {server.INewEntity=} [properties] Properties to set
         * @returns {server.NewEntity} NewEntity instance
         */
        NewEntity.create = function create(properties) {
            return new NewEntity(properties);
        };

        /**
         * Encodes the specified NewEntity message. Does not implicitly {@link server.NewEntity.verify|verify} messages.
         * @function encode
         * @memberof server.NewEntity
         * @static
         * @param {server.INewEntity} message NewEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NewEntity.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientId != null && Object.hasOwnProperty.call(message, "clientId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.clientId);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.y);
            if (message.angle != null && Object.hasOwnProperty.call(message, "angle"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.angle);
            if (message.segmentCount != null && Object.hasOwnProperty.call(message, "segmentCount"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.segmentCount);
            return writer;
        };

        /**
         * Encodes the specified NewEntity message, length delimited. Does not implicitly {@link server.NewEntity.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.NewEntity
         * @static
         * @param {server.INewEntity} message NewEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NewEntity.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a NewEntity message from the specified reader or buffer.
         * @function decode
         * @memberof server.NewEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.NewEntity} NewEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NewEntity.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.NewEntity();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.clientId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.name = reader.string();
                        break;
                    }
                case 3: {
                        message.x = reader.uint32();
                        break;
                    }
                case 4: {
                        message.y = reader.uint32();
                        break;
                    }
                case 5: {
                        message.angle = reader.uint32();
                        break;
                    }
                case 6: {
                        message.segmentCount = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a NewEntity message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.NewEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.NewEntity} NewEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NewEntity.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a NewEntity message.
         * @function verify
         * @memberof server.NewEntity
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        NewEntity.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.clientId != null && message.hasOwnProperty("clientId"))
                if (!$util.isInteger(message.clientId))
                    return "clientId: integer expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            if (message.angle != null && message.hasOwnProperty("angle"))
                if (!$util.isInteger(message.angle))
                    return "angle: integer expected";
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                if (!$util.isInteger(message.segmentCount))
                    return "segmentCount: integer expected";
            return null;
        };

        /**
         * Creates a NewEntity message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.NewEntity
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.NewEntity} NewEntity
         */
        NewEntity.fromObject = function fromObject(object) {
            if (object instanceof $root.server.NewEntity)
                return object;
            let message = new $root.server.NewEntity();
            if (object.clientId != null)
                message.clientId = object.clientId >>> 0;
            if (object.name != null)
                message.name = String(object.name);
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            if (object.angle != null)
                message.angle = object.angle >>> 0;
            if (object.segmentCount != null)
                message.segmentCount = object.segmentCount >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a NewEntity message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.NewEntity
         * @static
         * @param {server.NewEntity} message NewEntity
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NewEntity.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.clientId = 0;
                object.name = "";
                object.x = 0;
                object.y = 0;
                object.angle = 0;
                object.segmentCount = 0;
            }
            if (message.clientId != null && message.hasOwnProperty("clientId"))
                object.clientId = message.clientId;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            if (message.angle != null && message.hasOwnProperty("angle"))
                object.angle = message.angle;
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                object.segmentCount = message.segmentCount;
            return object;
        };

        /**
         * Converts this NewEntity to JSON.
         * @function toJSON
         * @memberof server.NewEntity
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NewEntity.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NewEntity
         * @function getTypeUrl
         * @memberof server.NewEntity
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NewEntity.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.NewEntity";
        };

        return NewEntity;
    })();

    server.Pong = (function() {

        /**
         * Properties of a Pong.
         * @memberof server
         * @interface IPong
         * @property {number|Long|null} [clientTimestamp] Pong clientTimestamp
         * @property {number|Long|null} [serverTimestamp] Pong serverTimestamp
         * @property {number|null} [nonce] Pong nonce
         */

        /**
         * Constructs a new Pong.
         * @memberof server
         * @classdesc Represents a Pong.
         * @implements IPong
         * @constructor
         * @param {server.IPong=} [properties] Properties to set
         */
        function Pong(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Pong clientTimestamp.
         * @member {number|Long} clientTimestamp
         * @memberof server.Pong
         * @instance
         */
        Pong.prototype.clientTimestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Pong serverTimestamp.
         * @member {number|Long} serverTimestamp
         * @memberof server.Pong
         * @instance
         */
        Pong.prototype.serverTimestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Pong nonce.
         * @member {number} nonce
         * @memberof server.Pong
         * @instance
         */
        Pong.prototype.nonce = 0;

        /**
         * Creates a new Pong instance using the specified properties.
         * @function create
         * @memberof server.Pong
         * @static
         * @param {server.IPong=} [properties] Properties to set
         * @returns {server.Pong} Pong instance
         */
        Pong.create = function create(properties) {
            return new Pong(properties);
        };

        /**
         * Encodes the specified Pong message. Does not implicitly {@link server.Pong.verify|verify} messages.
         * @function encode
         * @memberof server.Pong
         * @static
         * @param {server.IPong} message Pong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Pong.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientTimestamp != null && Object.hasOwnProperty.call(message, "clientTimestamp"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.clientTimestamp);
            if (message.serverTimestamp != null && Object.hasOwnProperty.call(message, "serverTimestamp"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.serverTimestamp);
            if (message.nonce != null && Object.hasOwnProperty.call(message, "nonce"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.nonce);
            return writer;
        };

        /**
         * Encodes the specified Pong message, length delimited. Does not implicitly {@link server.Pong.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.Pong
         * @static
         * @param {server.IPong} message Pong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Pong.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Pong message from the specified reader or buffer.
         * @function decode
         * @memberof server.Pong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.Pong} Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Pong.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.Pong();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.clientTimestamp = reader.uint64();
                        break;
                    }
                case 2: {
                        message.serverTimestamp = reader.uint64();
                        break;
                    }
                case 3: {
                        message.nonce = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Pong message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.Pong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.Pong} Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Pong.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Pong message.
         * @function verify
         * @memberof server.Pong
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Pong.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (!$util.isInteger(message.clientTimestamp) && !(message.clientTimestamp && $util.isInteger(message.clientTimestamp.low) && $util.isInteger(message.clientTimestamp.high)))
                    return "clientTimestamp: integer|Long expected";
            if (message.serverTimestamp != null && message.hasOwnProperty("serverTimestamp"))
                if (!$util.isInteger(message.serverTimestamp) && !(message.serverTimestamp && $util.isInteger(message.serverTimestamp.low) && $util.isInteger(message.serverTimestamp.high)))
                    return "serverTimestamp: integer|Long expected";
            if (message.nonce != null && message.hasOwnProperty("nonce"))
                if (!$util.isInteger(message.nonce))
                    return "nonce: integer expected";
            return null;
        };

        /**
         * Creates a Pong message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.Pong
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.Pong} Pong
         */
        Pong.fromObject = function fromObject(object) {
            if (object instanceof $root.server.Pong)
                return object;
            let message = new $root.server.Pong();
            if (object.clientTimestamp != null)
                if ($util.Long)
                    (message.clientTimestamp = $util.Long.fromValue(object.clientTimestamp)).unsigned = true;
                else if (typeof object.clientTimestamp === "string")
                    message.clientTimestamp = parseInt(object.clientTimestamp, 10);
                else if (typeof object.clientTimestamp === "number")
                    message.clientTimestamp = object.clientTimestamp;
                else if (typeof object.clientTimestamp === "object")
                    message.clientTimestamp = new $util.LongBits(object.clientTimestamp.low >>> 0, object.clientTimestamp.high >>> 0).toNumber(true);
            if (object.serverTimestamp != null)
                if ($util.Long)
                    (message.serverTimestamp = $util.Long.fromValue(object.serverTimestamp)).unsigned = true;
                else if (typeof object.serverTimestamp === "string")
                    message.serverTimestamp = parseInt(object.serverTimestamp, 10);
                else if (typeof object.serverTimestamp === "number")
                    message.serverTimestamp = object.serverTimestamp;
                else if (typeof object.serverTimestamp === "object")
                    message.serverTimestamp = new $util.LongBits(object.serverTimestamp.low >>> 0, object.serverTimestamp.high >>> 0).toNumber(true);
            if (object.nonce != null)
                message.nonce = object.nonce >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a Pong message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.Pong
         * @static
         * @param {server.Pong} message Pong
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Pong.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.clientTimestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.clientTimestamp = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.serverTimestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.serverTimestamp = options.longs === String ? "0" : 0;
                object.nonce = 0;
            }
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (typeof message.clientTimestamp === "number")
                    object.clientTimestamp = options.longs === String ? String(message.clientTimestamp) : message.clientTimestamp;
                else
                    object.clientTimestamp = options.longs === String ? $util.Long.prototype.toString.call(message.clientTimestamp) : options.longs === Number ? new $util.LongBits(message.clientTimestamp.low >>> 0, message.clientTimestamp.high >>> 0).toNumber(true) : message.clientTimestamp;
            if (message.serverTimestamp != null && message.hasOwnProperty("serverTimestamp"))
                if (typeof message.serverTimestamp === "number")
                    object.serverTimestamp = options.longs === String ? String(message.serverTimestamp) : message.serverTimestamp;
                else
                    object.serverTimestamp = options.longs === String ? $util.Long.prototype.toString.call(message.serverTimestamp) : options.longs === Number ? new $util.LongBits(message.serverTimestamp.low >>> 0, message.serverTimestamp.high >>> 0).toNumber(true) : message.serverTimestamp;
            if (message.nonce != null && message.hasOwnProperty("nonce"))
                object.nonce = message.nonce;
            return object;
        };

        /**
         * Converts this Pong to JSON.
         * @function toJSON
         * @memberof server.Pong
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Pong.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Pong
         * @function getTypeUrl
         * @memberof server.Pong
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Pong.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.Pong";
        };

        return Pong;
    })();

    server.RemoveEntity = (function() {

        /**
         * Properties of a RemoveEntity.
         * @memberof server
         * @interface IRemoveEntity
         * @property {number|null} [entityId] RemoveEntity entityId
         */

        /**
         * Constructs a new RemoveEntity.
         * @memberof server
         * @classdesc Represents a RemoveEntity.
         * @implements IRemoveEntity
         * @constructor
         * @param {server.IRemoveEntity=} [properties] Properties to set
         */
        function RemoveEntity(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * RemoveEntity entityId.
         * @member {number} entityId
         * @memberof server.RemoveEntity
         * @instance
         */
        RemoveEntity.prototype.entityId = 0;

        /**
         * Creates a new RemoveEntity instance using the specified properties.
         * @function create
         * @memberof server.RemoveEntity
         * @static
         * @param {server.IRemoveEntity=} [properties] Properties to set
         * @returns {server.RemoveEntity} RemoveEntity instance
         */
        RemoveEntity.create = function create(properties) {
            return new RemoveEntity(properties);
        };

        /**
         * Encodes the specified RemoveEntity message. Does not implicitly {@link server.RemoveEntity.verify|verify} messages.
         * @function encode
         * @memberof server.RemoveEntity
         * @static
         * @param {server.IRemoveEntity} message RemoveEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RemoveEntity.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityId != null && Object.hasOwnProperty.call(message, "entityId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.entityId);
            return writer;
        };

        /**
         * Encodes the specified RemoveEntity message, length delimited. Does not implicitly {@link server.RemoveEntity.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.RemoveEntity
         * @static
         * @param {server.IRemoveEntity} message RemoveEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RemoveEntity.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a RemoveEntity message from the specified reader or buffer.
         * @function decode
         * @memberof server.RemoveEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.RemoveEntity} RemoveEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RemoveEntity.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.RemoveEntity();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entityId = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a RemoveEntity message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.RemoveEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.RemoveEntity} RemoveEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RemoveEntity.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a RemoveEntity message.
         * @function verify
         * @memberof server.RemoveEntity
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        RemoveEntity.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                if (!$util.isInteger(message.entityId))
                    return "entityId: integer expected";
            return null;
        };

        /**
         * Creates a RemoveEntity message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.RemoveEntity
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.RemoveEntity} RemoveEntity
         */
        RemoveEntity.fromObject = function fromObject(object) {
            if (object instanceof $root.server.RemoveEntity)
                return object;
            let message = new $root.server.RemoveEntity();
            if (object.entityId != null)
                message.entityId = object.entityId >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a RemoveEntity message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.RemoveEntity
         * @static
         * @param {server.RemoveEntity} message RemoveEntity
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        RemoveEntity.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults)
                object.entityId = 0;
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                object.entityId = message.entityId;
            return object;
        };

        /**
         * Converts this RemoveEntity to JSON.
         * @function toJSON
         * @memberof server.RemoveEntity
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        RemoveEntity.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for RemoveEntity
         * @function getTypeUrl
         * @memberof server.RemoveEntity
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        RemoveEntity.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.RemoveEntity";
        };

        return RemoveEntity;
    })();

    server.ServerEnvelope = (function() {

        /**
         * Properties of a ServerEnvelope.
         * @memberof server
         * @interface IServerEnvelope
         * @property {server.IStartInformation|null} [startInformation] ServerEnvelope startInformation
         * @property {server.IEntityCollection|null} [entityCollection] ServerEnvelope entityCollection
         * @property {server.IRemoveEntity|null} [removeEntity] ServerEnvelope removeEntity
         * @property {server.IPong|null} [pong] ServerEnvelope pong
         * @property {server.IDeathNotification|null} [deathNotification] ServerEnvelope deathNotification
         * @property {server.ISelfPosition|null} [selfPosition] ServerEnvelope selfPosition
         * @property {server.ISegmentMutationCollection|null} [segmentMutationCollection] ServerEnvelope segmentMutationCollection
         * @property {server.IFoodCollection|null} [foodCollection] ServerEnvelope foodCollection
         * @property {server.IFoodMutationCollection|null} [foodMutationCollection] ServerEnvelope foodMutationCollection
         */

        /**
         * Constructs a new ServerEnvelope.
         * @memberof server
         * @classdesc Represents a ServerEnvelope.
         * @implements IServerEnvelope
         * @constructor
         * @param {server.IServerEnvelope=} [properties] Properties to set
         */
        function ServerEnvelope(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerEnvelope startInformation.
         * @member {server.IStartInformation|null|undefined} startInformation
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.startInformation = null;

        /**
         * ServerEnvelope entityCollection.
         * @member {server.IEntityCollection|null|undefined} entityCollection
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.entityCollection = null;

        /**
         * ServerEnvelope removeEntity.
         * @member {server.IRemoveEntity|null|undefined} removeEntity
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.removeEntity = null;

        /**
         * ServerEnvelope pong.
         * @member {server.IPong|null|undefined} pong
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.pong = null;

        /**
         * ServerEnvelope deathNotification.
         * @member {server.IDeathNotification|null|undefined} deathNotification
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.deathNotification = null;

        /**
         * ServerEnvelope selfPosition.
         * @member {server.ISelfPosition|null|undefined} selfPosition
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.selfPosition = null;

        /**
         * ServerEnvelope segmentMutationCollection.
         * @member {server.ISegmentMutationCollection|null|undefined} segmentMutationCollection
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.segmentMutationCollection = null;

        /**
         * ServerEnvelope foodCollection.
         * @member {server.IFoodCollection|null|undefined} foodCollection
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.foodCollection = null;

        /**
         * ServerEnvelope foodMutationCollection.
         * @member {server.IFoodMutationCollection|null|undefined} foodMutationCollection
         * @memberof server.ServerEnvelope
         * @instance
         */
        ServerEnvelope.prototype.foodMutationCollection = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * ServerEnvelope payload.
         * @member {"startInformation"|"entityCollection"|"removeEntity"|"pong"|"deathNotification"|undefined} payload
         * @memberof server.ServerEnvelope
         * @instance
         */
        Object.defineProperty(ServerEnvelope.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["startInformation", "entityCollection", "removeEntity", "pong", "deathNotification"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ServerEnvelope instance using the specified properties.
         * @function create
         * @memberof server.ServerEnvelope
         * @static
         * @param {server.IServerEnvelope=} [properties] Properties to set
         * @returns {server.ServerEnvelope} ServerEnvelope instance
         */
        ServerEnvelope.create = function create(properties) {
            return new ServerEnvelope(properties);
        };

        /**
         * Encodes the specified ServerEnvelope message. Does not implicitly {@link server.ServerEnvelope.verify|verify} messages.
         * @function encode
         * @memberof server.ServerEnvelope
         * @static
         * @param {server.IServerEnvelope} message ServerEnvelope message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerEnvelope.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.startInformation != null && Object.hasOwnProperty.call(message, "startInformation"))
                $root.server.StartInformation.encode(message.startInformation, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.entityCollection != null && Object.hasOwnProperty.call(message, "entityCollection"))
                $root.server.EntityCollection.encode(message.entityCollection, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.removeEntity != null && Object.hasOwnProperty.call(message, "removeEntity"))
                $root.server.RemoveEntity.encode(message.removeEntity, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.pong != null && Object.hasOwnProperty.call(message, "pong"))
                $root.server.Pong.encode(message.pong, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.deathNotification != null && Object.hasOwnProperty.call(message, "deathNotification"))
                $root.server.DeathNotification.encode(message.deathNotification, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.selfPosition != null && Object.hasOwnProperty.call(message, "selfPosition"))
                $root.server.SelfPosition.encode(message.selfPosition, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
            if (message.segmentMutationCollection != null && Object.hasOwnProperty.call(message, "segmentMutationCollection"))
                $root.server.SegmentMutationCollection.encode(message.segmentMutationCollection, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
            if (message.foodCollection != null && Object.hasOwnProperty.call(message, "foodCollection"))
                $root.server.FoodCollection.encode(message.foodCollection, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
            if (message.foodMutationCollection != null && Object.hasOwnProperty.call(message, "foodMutationCollection"))
                $root.server.FoodMutationCollection.encode(message.foodMutationCollection, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ServerEnvelope message, length delimited. Does not implicitly {@link server.ServerEnvelope.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.ServerEnvelope
         * @static
         * @param {server.IServerEnvelope} message ServerEnvelope message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerEnvelope.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerEnvelope message from the specified reader or buffer.
         * @function decode
         * @memberof server.ServerEnvelope
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.ServerEnvelope} ServerEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerEnvelope.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.ServerEnvelope();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.startInformation = $root.server.StartInformation.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.entityCollection = $root.server.EntityCollection.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.removeEntity = $root.server.RemoveEntity.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.pong = $root.server.Pong.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.deathNotification = $root.server.DeathNotification.decode(reader, reader.uint32());
                        break;
                    }
                case 10: {
                        message.selfPosition = $root.server.SelfPosition.decode(reader, reader.uint32());
                        break;
                    }
                case 11: {
                        message.segmentMutationCollection = $root.server.SegmentMutationCollection.decode(reader, reader.uint32());
                        break;
                    }
                case 12: {
                        message.foodCollection = $root.server.FoodCollection.decode(reader, reader.uint32());
                        break;
                    }
                case 13: {
                        message.foodMutationCollection = $root.server.FoodMutationCollection.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ServerEnvelope message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.ServerEnvelope
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.ServerEnvelope} ServerEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerEnvelope.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerEnvelope message.
         * @function verify
         * @memberof server.ServerEnvelope
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerEnvelope.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.startInformation != null && message.hasOwnProperty("startInformation")) {
                properties.payload = 1;
                {
                    let error = $root.server.StartInformation.verify(message.startInformation);
                    if (error)
                        return "startInformation." + error;
                }
            }
            if (message.entityCollection != null && message.hasOwnProperty("entityCollection")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.server.EntityCollection.verify(message.entityCollection);
                    if (error)
                        return "entityCollection." + error;
                }
            }
            if (message.removeEntity != null && message.hasOwnProperty("removeEntity")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.server.RemoveEntity.verify(message.removeEntity);
                    if (error)
                        return "removeEntity." + error;
                }
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.server.Pong.verify(message.pong);
                    if (error)
                        return "pong." + error;
                }
            }
            if (message.deathNotification != null && message.hasOwnProperty("deathNotification")) {
                if (properties.payload === 1)
                    return "payload: multiple values";
                properties.payload = 1;
                {
                    let error = $root.server.DeathNotification.verify(message.deathNotification);
                    if (error)
                        return "deathNotification." + error;
                }
            }
            if (message.selfPosition != null && message.hasOwnProperty("selfPosition")) {
                let error = $root.server.SelfPosition.verify(message.selfPosition);
                if (error)
                    return "selfPosition." + error;
            }
            if (message.segmentMutationCollection != null && message.hasOwnProperty("segmentMutationCollection")) {
                let error = $root.server.SegmentMutationCollection.verify(message.segmentMutationCollection);
                if (error)
                    return "segmentMutationCollection." + error;
            }
            if (message.foodCollection != null && message.hasOwnProperty("foodCollection")) {
                let error = $root.server.FoodCollection.verify(message.foodCollection);
                if (error)
                    return "foodCollection." + error;
            }
            if (message.foodMutationCollection != null && message.hasOwnProperty("foodMutationCollection")) {
                let error = $root.server.FoodMutationCollection.verify(message.foodMutationCollection);
                if (error)
                    return "foodMutationCollection." + error;
            }
            return null;
        };

        /**
         * Creates a ServerEnvelope message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.ServerEnvelope
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.ServerEnvelope} ServerEnvelope
         */
        ServerEnvelope.fromObject = function fromObject(object) {
            if (object instanceof $root.server.ServerEnvelope)
                return object;
            let message = new $root.server.ServerEnvelope();
            if (object.startInformation != null) {
                if (typeof object.startInformation !== "object")
                    throw TypeError(".server.ServerEnvelope.startInformation: object expected");
                message.startInformation = $root.server.StartInformation.fromObject(object.startInformation);
            }
            if (object.entityCollection != null) {
                if (typeof object.entityCollection !== "object")
                    throw TypeError(".server.ServerEnvelope.entityCollection: object expected");
                message.entityCollection = $root.server.EntityCollection.fromObject(object.entityCollection);
            }
            if (object.removeEntity != null) {
                if (typeof object.removeEntity !== "object")
                    throw TypeError(".server.ServerEnvelope.removeEntity: object expected");
                message.removeEntity = $root.server.RemoveEntity.fromObject(object.removeEntity);
            }
            if (object.pong != null) {
                if (typeof object.pong !== "object")
                    throw TypeError(".server.ServerEnvelope.pong: object expected");
                message.pong = $root.server.Pong.fromObject(object.pong);
            }
            if (object.deathNotification != null) {
                if (typeof object.deathNotification !== "object")
                    throw TypeError(".server.ServerEnvelope.deathNotification: object expected");
                message.deathNotification = $root.server.DeathNotification.fromObject(object.deathNotification);
            }
            if (object.selfPosition != null) {
                if (typeof object.selfPosition !== "object")
                    throw TypeError(".server.ServerEnvelope.selfPosition: object expected");
                message.selfPosition = $root.server.SelfPosition.fromObject(object.selfPosition);
            }
            if (object.segmentMutationCollection != null) {
                if (typeof object.segmentMutationCollection !== "object")
                    throw TypeError(".server.ServerEnvelope.segmentMutationCollection: object expected");
                message.segmentMutationCollection = $root.server.SegmentMutationCollection.fromObject(object.segmentMutationCollection);
            }
            if (object.foodCollection != null) {
                if (typeof object.foodCollection !== "object")
                    throw TypeError(".server.ServerEnvelope.foodCollection: object expected");
                message.foodCollection = $root.server.FoodCollection.fromObject(object.foodCollection);
            }
            if (object.foodMutationCollection != null) {
                if (typeof object.foodMutationCollection !== "object")
                    throw TypeError(".server.ServerEnvelope.foodMutationCollection: object expected");
                message.foodMutationCollection = $root.server.FoodMutationCollection.fromObject(object.foodMutationCollection);
            }
            return message;
        };

        /**
         * Creates a plain object from a ServerEnvelope message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.ServerEnvelope
         * @static
         * @param {server.ServerEnvelope} message ServerEnvelope
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerEnvelope.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.selfPosition = null;
                object.segmentMutationCollection = null;
                object.foodCollection = null;
                object.foodMutationCollection = null;
            }
            if (message.startInformation != null && message.hasOwnProperty("startInformation")) {
                object.startInformation = $root.server.StartInformation.toObject(message.startInformation, options);
                if (options.oneofs)
                    object.payload = "startInformation";
            }
            if (message.entityCollection != null && message.hasOwnProperty("entityCollection")) {
                object.entityCollection = $root.server.EntityCollection.toObject(message.entityCollection, options);
                if (options.oneofs)
                    object.payload = "entityCollection";
            }
            if (message.removeEntity != null && message.hasOwnProperty("removeEntity")) {
                object.removeEntity = $root.server.RemoveEntity.toObject(message.removeEntity, options);
                if (options.oneofs)
                    object.payload = "removeEntity";
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                object.pong = $root.server.Pong.toObject(message.pong, options);
                if (options.oneofs)
                    object.payload = "pong";
            }
            if (message.deathNotification != null && message.hasOwnProperty("deathNotification")) {
                object.deathNotification = $root.server.DeathNotification.toObject(message.deathNotification, options);
                if (options.oneofs)
                    object.payload = "deathNotification";
            }
            if (message.selfPosition != null && message.hasOwnProperty("selfPosition"))
                object.selfPosition = $root.server.SelfPosition.toObject(message.selfPosition, options);
            if (message.segmentMutationCollection != null && message.hasOwnProperty("segmentMutationCollection"))
                object.segmentMutationCollection = $root.server.SegmentMutationCollection.toObject(message.segmentMutationCollection, options);
            if (message.foodCollection != null && message.hasOwnProperty("foodCollection"))
                object.foodCollection = $root.server.FoodCollection.toObject(message.foodCollection, options);
            if (message.foodMutationCollection != null && message.hasOwnProperty("foodMutationCollection"))
                object.foodMutationCollection = $root.server.FoodMutationCollection.toObject(message.foodMutationCollection, options);
            return object;
        };

        /**
         * Converts this ServerEnvelope to JSON.
         * @function toJSON
         * @memberof server.ServerEnvelope
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerEnvelope.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerEnvelope
         * @function getTypeUrl
         * @memberof server.ServerEnvelope
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerEnvelope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.ServerEnvelope";
        };

        return ServerEnvelope;
    })();

    server.StartInformation = (function() {

        /**
         * Properties of a StartInformation.
         * @memberof server
         * @interface IStartInformation
         * @property {number|null} [clientId] StartInformation clientId
         * @property {number|null} [x] StartInformation x
         * @property {number|null} [y] StartInformation y
         * @property {number|null} [segmentCount] StartInformation segmentCount
         * @property {number|null} [startDirection] StartInformation startDirection
         * @property {number|null} [scale] StartInformation scale
         * @property {number|null} [worldRadius] StartInformation worldRadius
         */

        /**
         * Constructs a new StartInformation.
         * @memberof server
         * @classdesc Represents a StartInformation.
         * @implements IStartInformation
         * @constructor
         * @param {server.IStartInformation=} [properties] Properties to set
         */
        function StartInformation(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * StartInformation clientId.
         * @member {number} clientId
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.clientId = 0;

        /**
         * StartInformation x.
         * @member {number} x
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.x = 0;

        /**
         * StartInformation y.
         * @member {number} y
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.y = 0;

        /**
         * StartInformation segmentCount.
         * @member {number} segmentCount
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.segmentCount = 0;

        /**
         * StartInformation startDirection.
         * @member {number} startDirection
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.startDirection = 0;

        /**
         * StartInformation scale.
         * @member {number} scale
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.scale = 0;

        /**
         * StartInformation worldRadius.
         * @member {number} worldRadius
         * @memberof server.StartInformation
         * @instance
         */
        StartInformation.prototype.worldRadius = 0;

        /**
         * Creates a new StartInformation instance using the specified properties.
         * @function create
         * @memberof server.StartInformation
         * @static
         * @param {server.IStartInformation=} [properties] Properties to set
         * @returns {server.StartInformation} StartInformation instance
         */
        StartInformation.create = function create(properties) {
            return new StartInformation(properties);
        };

        /**
         * Encodes the specified StartInformation message. Does not implicitly {@link server.StartInformation.verify|verify} messages.
         * @function encode
         * @memberof server.StartInformation
         * @static
         * @param {server.IStartInformation} message StartInformation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        StartInformation.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientId != null && Object.hasOwnProperty.call(message, "clientId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.clientId);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.y);
            if (message.segmentCount != null && Object.hasOwnProperty.call(message, "segmentCount"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.segmentCount);
            if (message.startDirection != null && Object.hasOwnProperty.call(message, "startDirection"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.startDirection);
            if (message.scale != null && Object.hasOwnProperty.call(message, "scale"))
                writer.uint32(/* id 6, wireType 5 =*/53).float(message.scale);
            if (message.worldRadius != null && Object.hasOwnProperty.call(message, "worldRadius"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.worldRadius);
            return writer;
        };

        /**
         * Encodes the specified StartInformation message, length delimited. Does not implicitly {@link server.StartInformation.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.StartInformation
         * @static
         * @param {server.IStartInformation} message StartInformation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        StartInformation.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a StartInformation message from the specified reader or buffer.
         * @function decode
         * @memberof server.StartInformation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.StartInformation} StartInformation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        StartInformation.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.StartInformation();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.clientId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.x = reader.uint32();
                        break;
                    }
                case 3: {
                        message.y = reader.uint32();
                        break;
                    }
                case 4: {
                        message.segmentCount = reader.uint32();
                        break;
                    }
                case 5: {
                        message.startDirection = reader.uint32();
                        break;
                    }
                case 6: {
                        message.scale = reader.float();
                        break;
                    }
                case 7: {
                        message.worldRadius = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a StartInformation message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.StartInformation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.StartInformation} StartInformation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        StartInformation.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a StartInformation message.
         * @function verify
         * @memberof server.StartInformation
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        StartInformation.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.clientId != null && message.hasOwnProperty("clientId"))
                if (!$util.isInteger(message.clientId))
                    return "clientId: integer expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                if (!$util.isInteger(message.segmentCount))
                    return "segmentCount: integer expected";
            if (message.startDirection != null && message.hasOwnProperty("startDirection"))
                if (!$util.isInteger(message.startDirection))
                    return "startDirection: integer expected";
            if (message.scale != null && message.hasOwnProperty("scale"))
                if (typeof message.scale !== "number")
                    return "scale: number expected";
            if (message.worldRadius != null && message.hasOwnProperty("worldRadius"))
                if (typeof message.worldRadius !== "number")
                    return "worldRadius: number expected";
            return null;
        };

        /**
         * Creates a StartInformation message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.StartInformation
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.StartInformation} StartInformation
         */
        StartInformation.fromObject = function fromObject(object) {
            if (object instanceof $root.server.StartInformation)
                return object;
            let message = new $root.server.StartInformation();
            if (object.clientId != null)
                message.clientId = object.clientId >>> 0;
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            if (object.segmentCount != null)
                message.segmentCount = object.segmentCount >>> 0;
            if (object.startDirection != null)
                message.startDirection = object.startDirection >>> 0;
            if (object.scale != null)
                message.scale = Number(object.scale);
            if (object.worldRadius != null)
                message.worldRadius = Number(object.worldRadius);
            return message;
        };

        /**
         * Creates a plain object from a StartInformation message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.StartInformation
         * @static
         * @param {server.StartInformation} message StartInformation
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        StartInformation.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.clientId = 0;
                object.x = 0;
                object.y = 0;
                object.segmentCount = 0;
                object.startDirection = 0;
                object.scale = 0;
                object.worldRadius = 0;
            }
            if (message.clientId != null && message.hasOwnProperty("clientId"))
                object.clientId = message.clientId;
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                object.segmentCount = message.segmentCount;
            if (message.startDirection != null && message.hasOwnProperty("startDirection"))
                object.startDirection = message.startDirection;
            if (message.scale != null && message.hasOwnProperty("scale"))
                object.scale = options.json && !isFinite(message.scale) ? String(message.scale) : message.scale;
            if (message.worldRadius != null && message.hasOwnProperty("worldRadius"))
                object.worldRadius = options.json && !isFinite(message.worldRadius) ? String(message.worldRadius) : message.worldRadius;
            return object;
        };

        /**
         * Converts this StartInformation to JSON.
         * @function toJSON
         * @memberof server.StartInformation
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        StartInformation.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for StartInformation
         * @function getTypeUrl
         * @memberof server.StartInformation
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        StartInformation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.StartInformation";
        };

        return StartInformation;
    })();

    server.UpdateEntity = (function() {

        /**
         * Properties of an UpdateEntity.
         * @memberof server
         * @interface IUpdateEntity
         * @property {number|null} [entityId] UpdateEntity entityId
         * @property {number|null} [x] UpdateEntity x
         * @property {number|null} [y] UpdateEntity y
         * @property {number|null} [angle] UpdateEntity angle
         * @property {number|null} [segmentCount] UpdateEntity segmentCount
         */

        /**
         * Constructs a new UpdateEntity.
         * @memberof server
         * @classdesc Represents an UpdateEntity.
         * @implements IUpdateEntity
         * @constructor
         * @param {server.IUpdateEntity=} [properties] Properties to set
         */
        function UpdateEntity(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UpdateEntity entityId.
         * @member {number} entityId
         * @memberof server.UpdateEntity
         * @instance
         */
        UpdateEntity.prototype.entityId = 0;

        /**
         * UpdateEntity x.
         * @member {number} x
         * @memberof server.UpdateEntity
         * @instance
         */
        UpdateEntity.prototype.x = 0;

        /**
         * UpdateEntity y.
         * @member {number} y
         * @memberof server.UpdateEntity
         * @instance
         */
        UpdateEntity.prototype.y = 0;

        /**
         * UpdateEntity angle.
         * @member {number} angle
         * @memberof server.UpdateEntity
         * @instance
         */
        UpdateEntity.prototype.angle = 0;

        /**
         * UpdateEntity segmentCount.
         * @member {number} segmentCount
         * @memberof server.UpdateEntity
         * @instance
         */
        UpdateEntity.prototype.segmentCount = 0;

        /**
         * Creates a new UpdateEntity instance using the specified properties.
         * @function create
         * @memberof server.UpdateEntity
         * @static
         * @param {server.IUpdateEntity=} [properties] Properties to set
         * @returns {server.UpdateEntity} UpdateEntity instance
         */
        UpdateEntity.create = function create(properties) {
            return new UpdateEntity(properties);
        };

        /**
         * Encodes the specified UpdateEntity message. Does not implicitly {@link server.UpdateEntity.verify|verify} messages.
         * @function encode
         * @memberof server.UpdateEntity
         * @static
         * @param {server.IUpdateEntity} message UpdateEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UpdateEntity.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityId != null && Object.hasOwnProperty.call(message, "entityId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.entityId);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.y);
            if (message.angle != null && Object.hasOwnProperty.call(message, "angle"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.angle);
            if (message.segmentCount != null && Object.hasOwnProperty.call(message, "segmentCount"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.segmentCount);
            return writer;
        };

        /**
         * Encodes the specified UpdateEntity message, length delimited. Does not implicitly {@link server.UpdateEntity.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.UpdateEntity
         * @static
         * @param {server.IUpdateEntity} message UpdateEntity message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UpdateEntity.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an UpdateEntity message from the specified reader or buffer.
         * @function decode
         * @memberof server.UpdateEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.UpdateEntity} UpdateEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UpdateEntity.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.UpdateEntity();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entityId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.x = reader.uint32();
                        break;
                    }
                case 3: {
                        message.y = reader.uint32();
                        break;
                    }
                case 4: {
                        message.angle = reader.uint32();
                        break;
                    }
                case 5: {
                        message.segmentCount = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an UpdateEntity message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.UpdateEntity
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.UpdateEntity} UpdateEntity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UpdateEntity.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an UpdateEntity message.
         * @function verify
         * @memberof server.UpdateEntity
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UpdateEntity.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                if (!$util.isInteger(message.entityId))
                    return "entityId: integer expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            if (message.angle != null && message.hasOwnProperty("angle"))
                if (!$util.isInteger(message.angle))
                    return "angle: integer expected";
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                if (!$util.isInteger(message.segmentCount))
                    return "segmentCount: integer expected";
            return null;
        };

        /**
         * Creates an UpdateEntity message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.UpdateEntity
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.UpdateEntity} UpdateEntity
         */
        UpdateEntity.fromObject = function fromObject(object) {
            if (object instanceof $root.server.UpdateEntity)
                return object;
            let message = new $root.server.UpdateEntity();
            if (object.entityId != null)
                message.entityId = object.entityId >>> 0;
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            if (object.angle != null)
                message.angle = object.angle >>> 0;
            if (object.segmentCount != null)
                message.segmentCount = object.segmentCount >>> 0;
            return message;
        };

        /**
         * Creates a plain object from an UpdateEntity message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.UpdateEntity
         * @static
         * @param {server.UpdateEntity} message UpdateEntity
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UpdateEntity.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.entityId = 0;
                object.x = 0;
                object.y = 0;
                object.angle = 0;
                object.segmentCount = 0;
            }
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                object.entityId = message.entityId;
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            if (message.angle != null && message.hasOwnProperty("angle"))
                object.angle = message.angle;
            if (message.segmentCount != null && message.hasOwnProperty("segmentCount"))
                object.segmentCount = message.segmentCount;
            return object;
        };

        /**
         * Converts this UpdateEntity to JSON.
         * @function toJSON
         * @memberof server.UpdateEntity
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UpdateEntity.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UpdateEntity
         * @function getTypeUrl
         * @memberof server.UpdateEntity
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UpdateEntity.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.UpdateEntity";
        };

        return UpdateEntity;
    })();

    server.EntityCollection = (function() {

        /**
         * Properties of an EntityCollection.
         * @memberof server
         * @interface IEntityCollection
         * @property {Array.<number>|null} [entityIds] EntityCollection entityIds
         * @property {Array.<number>|null} [xs] EntityCollection xs
         * @property {Array.<number>|null} [ys] EntityCollection ys
         * @property {Array.<number>|null} [angles] EntityCollection angles
         * @property {Array.<number>|null} [fullyDataEntityIds] EntityCollection fullyDataEntityIds
         * @property {Array.<number>|null} [fullyDataSegmentCounts] EntityCollection fullyDataSegmentCounts
         * @property {Array.<number>|null} [scales] EntityCollection scales
         * @property {Array.<server.IEntityPath>|null} [fullyDataPaths] EntityCollection fullyDataPaths
         */

        /**
         * Constructs a new EntityCollection.
         * @memberof server
         * @classdesc Represents an EntityCollection.
         * @implements IEntityCollection
         * @constructor
         * @param {server.IEntityCollection=} [properties] Properties to set
         */
        function EntityCollection(properties) {
            this.entityIds = [];
            this.xs = [];
            this.ys = [];
            this.angles = [];
            this.fullyDataEntityIds = [];
            this.fullyDataSegmentCounts = [];
            this.scales = [];
            this.fullyDataPaths = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * EntityCollection entityIds.
         * @member {Array.<number>} entityIds
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.entityIds = $util.emptyArray;

        /**
         * EntityCollection xs.
         * @member {Array.<number>} xs
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.xs = $util.emptyArray;

        /**
         * EntityCollection ys.
         * @member {Array.<number>} ys
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.ys = $util.emptyArray;

        /**
         * EntityCollection angles.
         * @member {Array.<number>} angles
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.angles = $util.emptyArray;

        /**
         * EntityCollection fullyDataEntityIds.
         * @member {Array.<number>} fullyDataEntityIds
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.fullyDataEntityIds = $util.emptyArray;

        /**
         * EntityCollection fullyDataSegmentCounts.
         * @member {Array.<number>} fullyDataSegmentCounts
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.fullyDataSegmentCounts = $util.emptyArray;

        /**
         * EntityCollection scales.
         * @member {Array.<number>} scales
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.scales = $util.emptyArray;

        /**
         * EntityCollection fullyDataPaths.
         * @member {Array.<server.IEntityPath>} fullyDataPaths
         * @memberof server.EntityCollection
         * @instance
         */
        EntityCollection.prototype.fullyDataPaths = $util.emptyArray;

        /**
         * Creates a new EntityCollection instance using the specified properties.
         * @function create
         * @memberof server.EntityCollection
         * @static
         * @param {server.IEntityCollection=} [properties] Properties to set
         * @returns {server.EntityCollection} EntityCollection instance
         */
        EntityCollection.create = function create(properties) {
            return new EntityCollection(properties);
        };

        /**
         * Encodes the specified EntityCollection message. Does not implicitly {@link server.EntityCollection.verify|verify} messages.
         * @function encode
         * @memberof server.EntityCollection
         * @static
         * @param {server.IEntityCollection} message EntityCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        EntityCollection.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityIds != null && message.entityIds.length) {
                writer.uint32(/* id 1, wireType 2 =*/10).fork();
                for (let i = 0; i < message.entityIds.length; ++i)
                    writer.uint32(message.entityIds[i]);
                writer.ldelim();
            }
            if (message.xs != null && message.xs.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (let i = 0; i < message.xs.length; ++i)
                    writer.uint32(message.xs[i]);
                writer.ldelim();
            }
            if (message.ys != null && message.ys.length) {
                writer.uint32(/* id 3, wireType 2 =*/26).fork();
                for (let i = 0; i < message.ys.length; ++i)
                    writer.uint32(message.ys[i]);
                writer.ldelim();
            }
            if (message.angles != null && message.angles.length) {
                writer.uint32(/* id 4, wireType 2 =*/34).fork();
                for (let i = 0; i < message.angles.length; ++i)
                    writer.uint32(message.angles[i]);
                writer.ldelim();
            }
            if (message.fullyDataEntityIds != null && message.fullyDataEntityIds.length) {
                writer.uint32(/* id 5, wireType 2 =*/42).fork();
                for (let i = 0; i < message.fullyDataEntityIds.length; ++i)
                    writer.uint32(message.fullyDataEntityIds[i]);
                writer.ldelim();
            }
            if (message.fullyDataSegmentCounts != null && message.fullyDataSegmentCounts.length) {
                writer.uint32(/* id 6, wireType 2 =*/50).fork();
                for (let i = 0; i < message.fullyDataSegmentCounts.length; ++i)
                    writer.uint32(message.fullyDataSegmentCounts[i]);
                writer.ldelim();
            }
            if (message.scales != null && message.scales.length) {
                writer.uint32(/* id 7, wireType 2 =*/58).fork();
                for (let i = 0; i < message.scales.length; ++i)
                    writer.float(message.scales[i]);
                writer.ldelim();
            }
            if (message.fullyDataPaths != null && message.fullyDataPaths.length)
                for (let i = 0; i < message.fullyDataPaths.length; ++i)
                    $root.server.EntityPath.encode(message.fullyDataPaths[i], writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified EntityCollection message, length delimited. Does not implicitly {@link server.EntityCollection.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.EntityCollection
         * @static
         * @param {server.IEntityCollection} message EntityCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        EntityCollection.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an EntityCollection message from the specified reader or buffer.
         * @function decode
         * @memberof server.EntityCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.EntityCollection} EntityCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        EntityCollection.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.EntityCollection();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.entityIds && message.entityIds.length))
                            message.entityIds = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.entityIds.push(reader.uint32());
                        } else
                            message.entityIds.push(reader.uint32());
                        break;
                    }
                case 2: {
                        if (!(message.xs && message.xs.length))
                            message.xs = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.xs.push(reader.uint32());
                        } else
                            message.xs.push(reader.uint32());
                        break;
                    }
                case 3: {
                        if (!(message.ys && message.ys.length))
                            message.ys = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.ys.push(reader.uint32());
                        } else
                            message.ys.push(reader.uint32());
                        break;
                    }
                case 4: {
                        if (!(message.angles && message.angles.length))
                            message.angles = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.angles.push(reader.uint32());
                        } else
                            message.angles.push(reader.uint32());
                        break;
                    }
                case 5: {
                        if (!(message.fullyDataEntityIds && message.fullyDataEntityIds.length))
                            message.fullyDataEntityIds = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.fullyDataEntityIds.push(reader.uint32());
                        } else
                            message.fullyDataEntityIds.push(reader.uint32());
                        break;
                    }
                case 6: {
                        if (!(message.fullyDataSegmentCounts && message.fullyDataSegmentCounts.length))
                            message.fullyDataSegmentCounts = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.fullyDataSegmentCounts.push(reader.uint32());
                        } else
                            message.fullyDataSegmentCounts.push(reader.uint32());
                        break;
                    }
                case 7: {
                        if (!(message.scales && message.scales.length))
                            message.scales = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.scales.push(reader.float());
                        } else
                            message.scales.push(reader.float());
                        break;
                    }
                case 8: {
                        if (!(message.fullyDataPaths && message.fullyDataPaths.length))
                            message.fullyDataPaths = [];
                        message.fullyDataPaths.push($root.server.EntityPath.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an EntityCollection message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.EntityCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.EntityCollection} EntityCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        EntityCollection.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an EntityCollection message.
         * @function verify
         * @memberof server.EntityCollection
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        EntityCollection.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityIds != null && message.hasOwnProperty("entityIds")) {
                if (!Array.isArray(message.entityIds))
                    return "entityIds: array expected";
                for (let i = 0; i < message.entityIds.length; ++i)
                    if (!$util.isInteger(message.entityIds[i]))
                        return "entityIds: integer[] expected";
            }
            if (message.xs != null && message.hasOwnProperty("xs")) {
                if (!Array.isArray(message.xs))
                    return "xs: array expected";
                for (let i = 0; i < message.xs.length; ++i)
                    if (!$util.isInteger(message.xs[i]))
                        return "xs: integer[] expected";
            }
            if (message.ys != null && message.hasOwnProperty("ys")) {
                if (!Array.isArray(message.ys))
                    return "ys: array expected";
                for (let i = 0; i < message.ys.length; ++i)
                    if (!$util.isInteger(message.ys[i]))
                        return "ys: integer[] expected";
            }
            if (message.angles != null && message.hasOwnProperty("angles")) {
                if (!Array.isArray(message.angles))
                    return "angles: array expected";
                for (let i = 0; i < message.angles.length; ++i)
                    if (!$util.isInteger(message.angles[i]))
                        return "angles: integer[] expected";
            }
            if (message.fullyDataEntityIds != null && message.hasOwnProperty("fullyDataEntityIds")) {
                if (!Array.isArray(message.fullyDataEntityIds))
                    return "fullyDataEntityIds: array expected";
                for (let i = 0; i < message.fullyDataEntityIds.length; ++i)
                    if (!$util.isInteger(message.fullyDataEntityIds[i]))
                        return "fullyDataEntityIds: integer[] expected";
            }
            if (message.fullyDataSegmentCounts != null && message.hasOwnProperty("fullyDataSegmentCounts")) {
                if (!Array.isArray(message.fullyDataSegmentCounts))
                    return "fullyDataSegmentCounts: array expected";
                for (let i = 0; i < message.fullyDataSegmentCounts.length; ++i)
                    if (!$util.isInteger(message.fullyDataSegmentCounts[i]))
                        return "fullyDataSegmentCounts: integer[] expected";
            }
            if (message.scales != null && message.hasOwnProperty("scales")) {
                if (!Array.isArray(message.scales))
                    return "scales: array expected";
                for (let i = 0; i < message.scales.length; ++i)
                    if (typeof message.scales[i] !== "number")
                        return "scales: number[] expected";
            }
            if (message.fullyDataPaths != null && message.hasOwnProperty("fullyDataPaths")) {
                if (!Array.isArray(message.fullyDataPaths))
                    return "fullyDataPaths: array expected";
                for (let i = 0; i < message.fullyDataPaths.length; ++i) {
                    let error = $root.server.EntityPath.verify(message.fullyDataPaths[i]);
                    if (error)
                        return "fullyDataPaths." + error;
                }
            }
            return null;
        };

        /**
         * Creates an EntityCollection message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.EntityCollection
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.EntityCollection} EntityCollection
         */
        EntityCollection.fromObject = function fromObject(object) {
            if (object instanceof $root.server.EntityCollection)
                return object;
            let message = new $root.server.EntityCollection();
            if (object.entityIds) {
                if (!Array.isArray(object.entityIds))
                    throw TypeError(".server.EntityCollection.entityIds: array expected");
                message.entityIds = [];
                for (let i = 0; i < object.entityIds.length; ++i)
                    message.entityIds[i] = object.entityIds[i] >>> 0;
            }
            if (object.xs) {
                if (!Array.isArray(object.xs))
                    throw TypeError(".server.EntityCollection.xs: array expected");
                message.xs = [];
                for (let i = 0; i < object.xs.length; ++i)
                    message.xs[i] = object.xs[i] >>> 0;
            }
            if (object.ys) {
                if (!Array.isArray(object.ys))
                    throw TypeError(".server.EntityCollection.ys: array expected");
                message.ys = [];
                for (let i = 0; i < object.ys.length; ++i)
                    message.ys[i] = object.ys[i] >>> 0;
            }
            if (object.angles) {
                if (!Array.isArray(object.angles))
                    throw TypeError(".server.EntityCollection.angles: array expected");
                message.angles = [];
                for (let i = 0; i < object.angles.length; ++i)
                    message.angles[i] = object.angles[i] >>> 0;
            }
            if (object.fullyDataEntityIds) {
                if (!Array.isArray(object.fullyDataEntityIds))
                    throw TypeError(".server.EntityCollection.fullyDataEntityIds: array expected");
                message.fullyDataEntityIds = [];
                for (let i = 0; i < object.fullyDataEntityIds.length; ++i)
                    message.fullyDataEntityIds[i] = object.fullyDataEntityIds[i] >>> 0;
            }
            if (object.fullyDataSegmentCounts) {
                if (!Array.isArray(object.fullyDataSegmentCounts))
                    throw TypeError(".server.EntityCollection.fullyDataSegmentCounts: array expected");
                message.fullyDataSegmentCounts = [];
                for (let i = 0; i < object.fullyDataSegmentCounts.length; ++i)
                    message.fullyDataSegmentCounts[i] = object.fullyDataSegmentCounts[i] >>> 0;
            }
            if (object.scales) {
                if (!Array.isArray(object.scales))
                    throw TypeError(".server.EntityCollection.scales: array expected");
                message.scales = [];
                for (let i = 0; i < object.scales.length; ++i)
                    message.scales[i] = Number(object.scales[i]);
            }
            if (object.fullyDataPaths) {
                if (!Array.isArray(object.fullyDataPaths))
                    throw TypeError(".server.EntityCollection.fullyDataPaths: array expected");
                message.fullyDataPaths = [];
                for (let i = 0; i < object.fullyDataPaths.length; ++i) {
                    if (typeof object.fullyDataPaths[i] !== "object")
                        throw TypeError(".server.EntityCollection.fullyDataPaths: object expected");
                    message.fullyDataPaths[i] = $root.server.EntityPath.fromObject(object.fullyDataPaths[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from an EntityCollection message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.EntityCollection
         * @static
         * @param {server.EntityCollection} message EntityCollection
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        EntityCollection.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.entityIds = [];
                object.xs = [];
                object.ys = [];
                object.angles = [];
                object.fullyDataEntityIds = [];
                object.fullyDataSegmentCounts = [];
                object.scales = [];
                object.fullyDataPaths = [];
            }
            if (message.entityIds && message.entityIds.length) {
                object.entityIds = [];
                for (let j = 0; j < message.entityIds.length; ++j)
                    object.entityIds[j] = message.entityIds[j];
            }
            if (message.xs && message.xs.length) {
                object.xs = [];
                for (let j = 0; j < message.xs.length; ++j)
                    object.xs[j] = message.xs[j];
            }
            if (message.ys && message.ys.length) {
                object.ys = [];
                for (let j = 0; j < message.ys.length; ++j)
                    object.ys[j] = message.ys[j];
            }
            if (message.angles && message.angles.length) {
                object.angles = [];
                for (let j = 0; j < message.angles.length; ++j)
                    object.angles[j] = message.angles[j];
            }
            if (message.fullyDataEntityIds && message.fullyDataEntityIds.length) {
                object.fullyDataEntityIds = [];
                for (let j = 0; j < message.fullyDataEntityIds.length; ++j)
                    object.fullyDataEntityIds[j] = message.fullyDataEntityIds[j];
            }
            if (message.fullyDataSegmentCounts && message.fullyDataSegmentCounts.length) {
                object.fullyDataSegmentCounts = [];
                for (let j = 0; j < message.fullyDataSegmentCounts.length; ++j)
                    object.fullyDataSegmentCounts[j] = message.fullyDataSegmentCounts[j];
            }
            if (message.scales && message.scales.length) {
                object.scales = [];
                for (let j = 0; j < message.scales.length; ++j)
                    object.scales[j] = options.json && !isFinite(message.scales[j]) ? String(message.scales[j]) : message.scales[j];
            }
            if (message.fullyDataPaths && message.fullyDataPaths.length) {
                object.fullyDataPaths = [];
                for (let j = 0; j < message.fullyDataPaths.length; ++j)
                    object.fullyDataPaths[j] = $root.server.EntityPath.toObject(message.fullyDataPaths[j], options);
            }
            return object;
        };

        /**
         * Converts this EntityCollection to JSON.
         * @function toJSON
         * @memberof server.EntityCollection
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        EntityCollection.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for EntityCollection
         * @function getTypeUrl
         * @memberof server.EntityCollection
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        EntityCollection.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.EntityCollection";
        };

        return EntityCollection;
    })();

    server.EntityPath = (function() {

        /**
         * Properties of an EntityPath.
         * @memberof server
         * @interface IEntityPath
         * @property {number|null} [entityId] EntityPath entityId
         * @property {Array.<number>|null} [xs] EntityPath xs
         * @property {Array.<number>|null} [ys] EntityPath ys
         */

        /**
         * Constructs a new EntityPath.
         * @memberof server
         * @classdesc Represents an EntityPath.
         * @implements IEntityPath
         * @constructor
         * @param {server.IEntityPath=} [properties] Properties to set
         */
        function EntityPath(properties) {
            this.xs = [];
            this.ys = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * EntityPath entityId.
         * @member {number} entityId
         * @memberof server.EntityPath
         * @instance
         */
        EntityPath.prototype.entityId = 0;

        /**
         * EntityPath xs.
         * @member {Array.<number>} xs
         * @memberof server.EntityPath
         * @instance
         */
        EntityPath.prototype.xs = $util.emptyArray;

        /**
         * EntityPath ys.
         * @member {Array.<number>} ys
         * @memberof server.EntityPath
         * @instance
         */
        EntityPath.prototype.ys = $util.emptyArray;

        /**
         * Creates a new EntityPath instance using the specified properties.
         * @function create
         * @memberof server.EntityPath
         * @static
         * @param {server.IEntityPath=} [properties] Properties to set
         * @returns {server.EntityPath} EntityPath instance
         */
        EntityPath.create = function create(properties) {
            return new EntityPath(properties);
        };

        /**
         * Encodes the specified EntityPath message. Does not implicitly {@link server.EntityPath.verify|verify} messages.
         * @function encode
         * @memberof server.EntityPath
         * @static
         * @param {server.IEntityPath} message EntityPath message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        EntityPath.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityId != null && Object.hasOwnProperty.call(message, "entityId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.entityId);
            if (message.xs != null && message.xs.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (let i = 0; i < message.xs.length; ++i)
                    writer.uint32(message.xs[i]);
                writer.ldelim();
            }
            if (message.ys != null && message.ys.length) {
                writer.uint32(/* id 3, wireType 2 =*/26).fork();
                for (let i = 0; i < message.ys.length; ++i)
                    writer.uint32(message.ys[i]);
                writer.ldelim();
            }
            return writer;
        };

        /**
         * Encodes the specified EntityPath message, length delimited. Does not implicitly {@link server.EntityPath.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.EntityPath
         * @static
         * @param {server.IEntityPath} message EntityPath message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        EntityPath.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an EntityPath message from the specified reader or buffer.
         * @function decode
         * @memberof server.EntityPath
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.EntityPath} EntityPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        EntityPath.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.EntityPath();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entityId = reader.uint32();
                        break;
                    }
                case 2: {
                        if (!(message.xs && message.xs.length))
                            message.xs = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.xs.push(reader.uint32());
                        } else
                            message.xs.push(reader.uint32());
                        break;
                    }
                case 3: {
                        if (!(message.ys && message.ys.length))
                            message.ys = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.ys.push(reader.uint32());
                        } else
                            message.ys.push(reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an EntityPath message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.EntityPath
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.EntityPath} EntityPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        EntityPath.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an EntityPath message.
         * @function verify
         * @memberof server.EntityPath
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        EntityPath.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                if (!$util.isInteger(message.entityId))
                    return "entityId: integer expected";
            if (message.xs != null && message.hasOwnProperty("xs")) {
                if (!Array.isArray(message.xs))
                    return "xs: array expected";
                for (let i = 0; i < message.xs.length; ++i)
                    if (!$util.isInteger(message.xs[i]))
                        return "xs: integer[] expected";
            }
            if (message.ys != null && message.hasOwnProperty("ys")) {
                if (!Array.isArray(message.ys))
                    return "ys: array expected";
                for (let i = 0; i < message.ys.length; ++i)
                    if (!$util.isInteger(message.ys[i]))
                        return "ys: integer[] expected";
            }
            return null;
        };

        /**
         * Creates an EntityPath message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.EntityPath
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.EntityPath} EntityPath
         */
        EntityPath.fromObject = function fromObject(object) {
            if (object instanceof $root.server.EntityPath)
                return object;
            let message = new $root.server.EntityPath();
            if (object.entityId != null)
                message.entityId = object.entityId >>> 0;
            if (object.xs) {
                if (!Array.isArray(object.xs))
                    throw TypeError(".server.EntityPath.xs: array expected");
                message.xs = [];
                for (let i = 0; i < object.xs.length; ++i)
                    message.xs[i] = object.xs[i] >>> 0;
            }
            if (object.ys) {
                if (!Array.isArray(object.ys))
                    throw TypeError(".server.EntityPath.ys: array expected");
                message.ys = [];
                for (let i = 0; i < object.ys.length; ++i)
                    message.ys[i] = object.ys[i] >>> 0;
            }
            return message;
        };

        /**
         * Creates a plain object from an EntityPath message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.EntityPath
         * @static
         * @param {server.EntityPath} message EntityPath
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        EntityPath.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.xs = [];
                object.ys = [];
            }
            if (options.defaults)
                object.entityId = 0;
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                object.entityId = message.entityId;
            if (message.xs && message.xs.length) {
                object.xs = [];
                for (let j = 0; j < message.xs.length; ++j)
                    object.xs[j] = message.xs[j];
            }
            if (message.ys && message.ys.length) {
                object.ys = [];
                for (let j = 0; j < message.ys.length; ++j)
                    object.ys[j] = message.ys[j];
            }
            return object;
        };

        /**
         * Converts this EntityPath to JSON.
         * @function toJSON
         * @memberof server.EntityPath
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        EntityPath.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for EntityPath
         * @function getTypeUrl
         * @memberof server.EntityPath
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        EntityPath.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.EntityPath";
        };

        return EntityPath;
    })();

    server.SelfPosition = (function() {

        /**
         * Properties of a SelfPosition.
         * @memberof server
         * @interface ISelfPosition
         * @property {number|null} [entityId] SelfPosition entityId
         * @property {number|null} [x] SelfPosition x
         * @property {number|null} [y] SelfPosition y
         * @property {number|null} [scale] SelfPosition scale
         */

        /**
         * Constructs a new SelfPosition.
         * @memberof server
         * @classdesc Represents a SelfPosition.
         * @implements ISelfPosition
         * @constructor
         * @param {server.ISelfPosition=} [properties] Properties to set
         */
        function SelfPosition(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SelfPosition entityId.
         * @member {number} entityId
         * @memberof server.SelfPosition
         * @instance
         */
        SelfPosition.prototype.entityId = 0;

        /**
         * SelfPosition x.
         * @member {number} x
         * @memberof server.SelfPosition
         * @instance
         */
        SelfPosition.prototype.x = 0;

        /**
         * SelfPosition y.
         * @member {number} y
         * @memberof server.SelfPosition
         * @instance
         */
        SelfPosition.prototype.y = 0;

        /**
         * SelfPosition scale.
         * @member {number} scale
         * @memberof server.SelfPosition
         * @instance
         */
        SelfPosition.prototype.scale = 0;

        /**
         * Creates a new SelfPosition instance using the specified properties.
         * @function create
         * @memberof server.SelfPosition
         * @static
         * @param {server.ISelfPosition=} [properties] Properties to set
         * @returns {server.SelfPosition} SelfPosition instance
         */
        SelfPosition.create = function create(properties) {
            return new SelfPosition(properties);
        };

        /**
         * Encodes the specified SelfPosition message. Does not implicitly {@link server.SelfPosition.verify|verify} messages.
         * @function encode
         * @memberof server.SelfPosition
         * @static
         * @param {server.ISelfPosition} message SelfPosition message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SelfPosition.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityId != null && Object.hasOwnProperty.call(message, "entityId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.entityId);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.y);
            if (message.scale != null && Object.hasOwnProperty.call(message, "scale"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.scale);
            return writer;
        };

        /**
         * Encodes the specified SelfPosition message, length delimited. Does not implicitly {@link server.SelfPosition.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.SelfPosition
         * @static
         * @param {server.ISelfPosition} message SelfPosition message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SelfPosition.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SelfPosition message from the specified reader or buffer.
         * @function decode
         * @memberof server.SelfPosition
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.SelfPosition} SelfPosition
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SelfPosition.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.SelfPosition();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entityId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.x = reader.uint32();
                        break;
                    }
                case 3: {
                        message.y = reader.uint32();
                        break;
                    }
                case 4: {
                        message.scale = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SelfPosition message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.SelfPosition
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.SelfPosition} SelfPosition
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SelfPosition.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SelfPosition message.
         * @function verify
         * @memberof server.SelfPosition
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SelfPosition.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                if (!$util.isInteger(message.entityId))
                    return "entityId: integer expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            if (message.scale != null && message.hasOwnProperty("scale"))
                if (typeof message.scale !== "number")
                    return "scale: number expected";
            return null;
        };

        /**
         * Creates a SelfPosition message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.SelfPosition
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.SelfPosition} SelfPosition
         */
        SelfPosition.fromObject = function fromObject(object) {
            if (object instanceof $root.server.SelfPosition)
                return object;
            let message = new $root.server.SelfPosition();
            if (object.entityId != null)
                message.entityId = object.entityId >>> 0;
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            if (object.scale != null)
                message.scale = Number(object.scale);
            return message;
        };

        /**
         * Creates a plain object from a SelfPosition message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.SelfPosition
         * @static
         * @param {server.SelfPosition} message SelfPosition
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SelfPosition.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.entityId = 0;
                object.x = 0;
                object.y = 0;
                object.scale = 0;
            }
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                object.entityId = message.entityId;
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            if (message.scale != null && message.hasOwnProperty("scale"))
                object.scale = options.json && !isFinite(message.scale) ? String(message.scale) : message.scale;
            return object;
        };

        /**
         * Converts this SelfPosition to JSON.
         * @function toJSON
         * @memberof server.SelfPosition
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SelfPosition.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SelfPosition
         * @function getTypeUrl
         * @memberof server.SelfPosition
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SelfPosition.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.SelfPosition";
        };

        return SelfPosition;
    })();

    server.SegmentMutationCollection = (function() {

        /**
         * Properties of a SegmentMutationCollection.
         * @memberof server
         * @interface ISegmentMutationCollection
         * @property {Array.<server.ISegmentMutation>|null} [mutations] SegmentMutationCollection mutations
         */

        /**
         * Constructs a new SegmentMutationCollection.
         * @memberof server
         * @classdesc Represents a SegmentMutationCollection.
         * @implements ISegmentMutationCollection
         * @constructor
         * @param {server.ISegmentMutationCollection=} [properties] Properties to set
         */
        function SegmentMutationCollection(properties) {
            this.mutations = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SegmentMutationCollection mutations.
         * @member {Array.<server.ISegmentMutation>} mutations
         * @memberof server.SegmentMutationCollection
         * @instance
         */
        SegmentMutationCollection.prototype.mutations = $util.emptyArray;

        /**
         * Creates a new SegmentMutationCollection instance using the specified properties.
         * @function create
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {server.ISegmentMutationCollection=} [properties] Properties to set
         * @returns {server.SegmentMutationCollection} SegmentMutationCollection instance
         */
        SegmentMutationCollection.create = function create(properties) {
            return new SegmentMutationCollection(properties);
        };

        /**
         * Encodes the specified SegmentMutationCollection message. Does not implicitly {@link server.SegmentMutationCollection.verify|verify} messages.
         * @function encode
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {server.ISegmentMutationCollection} message SegmentMutationCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SegmentMutationCollection.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.mutations != null && message.mutations.length)
                for (let i = 0; i < message.mutations.length; ++i)
                    $root.server.SegmentMutation.encode(message.mutations[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified SegmentMutationCollection message, length delimited. Does not implicitly {@link server.SegmentMutationCollection.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {server.ISegmentMutationCollection} message SegmentMutationCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SegmentMutationCollection.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SegmentMutationCollection message from the specified reader or buffer.
         * @function decode
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.SegmentMutationCollection} SegmentMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SegmentMutationCollection.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.SegmentMutationCollection();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.mutations && message.mutations.length))
                            message.mutations = [];
                        message.mutations.push($root.server.SegmentMutation.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SegmentMutationCollection message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.SegmentMutationCollection} SegmentMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SegmentMutationCollection.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SegmentMutationCollection message.
         * @function verify
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SegmentMutationCollection.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.mutations != null && message.hasOwnProperty("mutations")) {
                if (!Array.isArray(message.mutations))
                    return "mutations: array expected";
                for (let i = 0; i < message.mutations.length; ++i) {
                    let error = $root.server.SegmentMutation.verify(message.mutations[i]);
                    if (error)
                        return "mutations." + error;
                }
            }
            return null;
        };

        /**
         * Creates a SegmentMutationCollection message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.SegmentMutationCollection} SegmentMutationCollection
         */
        SegmentMutationCollection.fromObject = function fromObject(object) {
            if (object instanceof $root.server.SegmentMutationCollection)
                return object;
            let message = new $root.server.SegmentMutationCollection();
            if (object.mutations) {
                if (!Array.isArray(object.mutations))
                    throw TypeError(".server.SegmentMutationCollection.mutations: array expected");
                message.mutations = [];
                for (let i = 0; i < object.mutations.length; ++i) {
                    if (typeof object.mutations[i] !== "object")
                        throw TypeError(".server.SegmentMutationCollection.mutations: object expected");
                    message.mutations[i] = $root.server.SegmentMutation.fromObject(object.mutations[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a SegmentMutationCollection message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {server.SegmentMutationCollection} message SegmentMutationCollection
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SegmentMutationCollection.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.mutations = [];
            if (message.mutations && message.mutations.length) {
                object.mutations = [];
                for (let j = 0; j < message.mutations.length; ++j)
                    object.mutations[j] = $root.server.SegmentMutation.toObject(message.mutations[j], options);
            }
            return object;
        };

        /**
         * Converts this SegmentMutationCollection to JSON.
         * @function toJSON
         * @memberof server.SegmentMutationCollection
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SegmentMutationCollection.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SegmentMutationCollection
         * @function getTypeUrl
         * @memberof server.SegmentMutationCollection
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SegmentMutationCollection.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.SegmentMutationCollection";
        };

        return SegmentMutationCollection;
    })();

    server.SegmentMutation = (function() {

        /**
         * Properties of a SegmentMutation.
         * @memberof server
         * @interface ISegmentMutation
         * @property {number|null} [entityId] SegmentMutation entityId
         * @property {server.SegmentMutation.MutationType|null} [mutationType] SegmentMutation mutationType
         * @property {number|null} [addedSegmentCount] SegmentMutation addedSegmentCount
         * @property {number|null} [removedSegmentCount] SegmentMutation removedSegmentCount
         */

        /**
         * Constructs a new SegmentMutation.
         * @memberof server
         * @classdesc Represents a SegmentMutation.
         * @implements ISegmentMutation
         * @constructor
         * @param {server.ISegmentMutation=} [properties] Properties to set
         */
        function SegmentMutation(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SegmentMutation entityId.
         * @member {number} entityId
         * @memberof server.SegmentMutation
         * @instance
         */
        SegmentMutation.prototype.entityId = 0;

        /**
         * SegmentMutation mutationType.
         * @member {server.SegmentMutation.MutationType} mutationType
         * @memberof server.SegmentMutation
         * @instance
         */
        SegmentMutation.prototype.mutationType = 0;

        /**
         * SegmentMutation addedSegmentCount.
         * @member {number} addedSegmentCount
         * @memberof server.SegmentMutation
         * @instance
         */
        SegmentMutation.prototype.addedSegmentCount = 0;

        /**
         * SegmentMutation removedSegmentCount.
         * @member {number} removedSegmentCount
         * @memberof server.SegmentMutation
         * @instance
         */
        SegmentMutation.prototype.removedSegmentCount = 0;

        /**
         * Creates a new SegmentMutation instance using the specified properties.
         * @function create
         * @memberof server.SegmentMutation
         * @static
         * @param {server.ISegmentMutation=} [properties] Properties to set
         * @returns {server.SegmentMutation} SegmentMutation instance
         */
        SegmentMutation.create = function create(properties) {
            return new SegmentMutation(properties);
        };

        /**
         * Encodes the specified SegmentMutation message. Does not implicitly {@link server.SegmentMutation.verify|verify} messages.
         * @function encode
         * @memberof server.SegmentMutation
         * @static
         * @param {server.ISegmentMutation} message SegmentMutation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SegmentMutation.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entityId != null && Object.hasOwnProperty.call(message, "entityId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.entityId);
            if (message.mutationType != null && Object.hasOwnProperty.call(message, "mutationType"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.mutationType);
            if (message.addedSegmentCount != null && Object.hasOwnProperty.call(message, "addedSegmentCount"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.addedSegmentCount);
            if (message.removedSegmentCount != null && Object.hasOwnProperty.call(message, "removedSegmentCount"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.removedSegmentCount);
            return writer;
        };

        /**
         * Encodes the specified SegmentMutation message, length delimited. Does not implicitly {@link server.SegmentMutation.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.SegmentMutation
         * @static
         * @param {server.ISegmentMutation} message SegmentMutation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SegmentMutation.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SegmentMutation message from the specified reader or buffer.
         * @function decode
         * @memberof server.SegmentMutation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.SegmentMutation} SegmentMutation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SegmentMutation.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.SegmentMutation();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.entityId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.mutationType = reader.int32();
                        break;
                    }
                case 3: {
                        message.addedSegmentCount = reader.uint32();
                        break;
                    }
                case 4: {
                        message.removedSegmentCount = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SegmentMutation message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.SegmentMutation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.SegmentMutation} SegmentMutation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SegmentMutation.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SegmentMutation message.
         * @function verify
         * @memberof server.SegmentMutation
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SegmentMutation.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                if (!$util.isInteger(message.entityId))
                    return "entityId: integer expected";
            if (message.mutationType != null && message.hasOwnProperty("mutationType"))
                switch (message.mutationType) {
                default:
                    return "mutationType: enum value expected";
                case 0:
                case 1:
                    break;
                }
            if (message.addedSegmentCount != null && message.hasOwnProperty("addedSegmentCount"))
                if (!$util.isInteger(message.addedSegmentCount))
                    return "addedSegmentCount: integer expected";
            if (message.removedSegmentCount != null && message.hasOwnProperty("removedSegmentCount"))
                if (!$util.isInteger(message.removedSegmentCount))
                    return "removedSegmentCount: integer expected";
            return null;
        };

        /**
         * Creates a SegmentMutation message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.SegmentMutation
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.SegmentMutation} SegmentMutation
         */
        SegmentMutation.fromObject = function fromObject(object) {
            if (object instanceof $root.server.SegmentMutation)
                return object;
            let message = new $root.server.SegmentMutation();
            if (object.entityId != null)
                message.entityId = object.entityId >>> 0;
            switch (object.mutationType) {
            default:
                if (typeof object.mutationType === "number") {
                    message.mutationType = object.mutationType;
                    break;
                }
                break;
            case "SEGMENT_ADD":
            case 0:
                message.mutationType = 0;
                break;
            case "SEGMENT_REMOVE":
            case 1:
                message.mutationType = 1;
                break;
            }
            if (object.addedSegmentCount != null)
                message.addedSegmentCount = object.addedSegmentCount >>> 0;
            if (object.removedSegmentCount != null)
                message.removedSegmentCount = object.removedSegmentCount >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a SegmentMutation message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.SegmentMutation
         * @static
         * @param {server.SegmentMutation} message SegmentMutation
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SegmentMutation.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.entityId = 0;
                object.mutationType = options.enums === String ? "SEGMENT_ADD" : 0;
                object.addedSegmentCount = 0;
                object.removedSegmentCount = 0;
            }
            if (message.entityId != null && message.hasOwnProperty("entityId"))
                object.entityId = message.entityId;
            if (message.mutationType != null && message.hasOwnProperty("mutationType"))
                object.mutationType = options.enums === String ? $root.server.SegmentMutation.MutationType[message.mutationType] === undefined ? message.mutationType : $root.server.SegmentMutation.MutationType[message.mutationType] : message.mutationType;
            if (message.addedSegmentCount != null && message.hasOwnProperty("addedSegmentCount"))
                object.addedSegmentCount = message.addedSegmentCount;
            if (message.removedSegmentCount != null && message.hasOwnProperty("removedSegmentCount"))
                object.removedSegmentCount = message.removedSegmentCount;
            return object;
        };

        /**
         * Converts this SegmentMutation to JSON.
         * @function toJSON
         * @memberof server.SegmentMutation
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SegmentMutation.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SegmentMutation
         * @function getTypeUrl
         * @memberof server.SegmentMutation
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SegmentMutation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.SegmentMutation";
        };

        /**
         * MutationType enum.
         * @name server.SegmentMutation.MutationType
         * @enum {number}
         * @property {number} SEGMENT_ADD=0 SEGMENT_ADD value
         * @property {number} SEGMENT_REMOVE=1 SEGMENT_REMOVE value
         */
        SegmentMutation.MutationType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "SEGMENT_ADD"] = 0;
            values[valuesById[1] = "SEGMENT_REMOVE"] = 1;
            return values;
        })();

        return SegmentMutation;
    })();

    server.FoodData = (function() {

        /**
         * Properties of a FoodData.
         * @memberof server
         * @interface IFoodData
         * @property {number|null} [foodId] FoodData foodId
         * @property {number|null} [x] FoodData x
         * @property {number|null} [y] FoodData y
         */

        /**
         * Constructs a new FoodData.
         * @memberof server
         * @classdesc Represents a FoodData.
         * @implements IFoodData
         * @constructor
         * @param {server.IFoodData=} [properties] Properties to set
         */
        function FoodData(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FoodData foodId.
         * @member {number} foodId
         * @memberof server.FoodData
         * @instance
         */
        FoodData.prototype.foodId = 0;

        /**
         * FoodData x.
         * @member {number} x
         * @memberof server.FoodData
         * @instance
         */
        FoodData.prototype.x = 0;

        /**
         * FoodData y.
         * @member {number} y
         * @memberof server.FoodData
         * @instance
         */
        FoodData.prototype.y = 0;

        /**
         * Creates a new FoodData instance using the specified properties.
         * @function create
         * @memberof server.FoodData
         * @static
         * @param {server.IFoodData=} [properties] Properties to set
         * @returns {server.FoodData} FoodData instance
         */
        FoodData.create = function create(properties) {
            return new FoodData(properties);
        };

        /**
         * Encodes the specified FoodData message. Does not implicitly {@link server.FoodData.verify|verify} messages.
         * @function encode
         * @memberof server.FoodData
         * @static
         * @param {server.IFoodData} message FoodData message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodData.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.foodId != null && Object.hasOwnProperty.call(message, "foodId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.foodId);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.y);
            return writer;
        };

        /**
         * Encodes the specified FoodData message, length delimited. Does not implicitly {@link server.FoodData.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.FoodData
         * @static
         * @param {server.IFoodData} message FoodData message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodData.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FoodData message from the specified reader or buffer.
         * @function decode
         * @memberof server.FoodData
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.FoodData} FoodData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodData.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.FoodData();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.foodId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.x = reader.uint32();
                        break;
                    }
                case 3: {
                        message.y = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FoodData message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.FoodData
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.FoodData} FoodData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodData.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FoodData message.
         * @function verify
         * @memberof server.FoodData
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FoodData.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.foodId != null && message.hasOwnProperty("foodId"))
                if (!$util.isInteger(message.foodId))
                    return "foodId: integer expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (!$util.isInteger(message.x))
                    return "x: integer expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (!$util.isInteger(message.y))
                    return "y: integer expected";
            return null;
        };

        /**
         * Creates a FoodData message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.FoodData
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.FoodData} FoodData
         */
        FoodData.fromObject = function fromObject(object) {
            if (object instanceof $root.server.FoodData)
                return object;
            let message = new $root.server.FoodData();
            if (object.foodId != null)
                message.foodId = object.foodId >>> 0;
            if (object.x != null)
                message.x = object.x >>> 0;
            if (object.y != null)
                message.y = object.y >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a FoodData message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.FoodData
         * @static
         * @param {server.FoodData} message FoodData
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FoodData.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.foodId = 0;
                object.x = 0;
                object.y = 0;
            }
            if (message.foodId != null && message.hasOwnProperty("foodId"))
                object.foodId = message.foodId;
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = message.y;
            return object;
        };

        /**
         * Converts this FoodData to JSON.
         * @function toJSON
         * @memberof server.FoodData
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FoodData.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FoodData
         * @function getTypeUrl
         * @memberof server.FoodData
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FoodData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.FoodData";
        };

        return FoodData;
    })();

    server.FoodCollection = (function() {

        /**
         * Properties of a FoodCollection.
         * @memberof server
         * @interface IFoodCollection
         * @property {Array.<server.IFoodData>|null} [foods] FoodCollection foods
         */

        /**
         * Constructs a new FoodCollection.
         * @memberof server
         * @classdesc Represents a FoodCollection.
         * @implements IFoodCollection
         * @constructor
         * @param {server.IFoodCollection=} [properties] Properties to set
         */
        function FoodCollection(properties) {
            this.foods = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FoodCollection foods.
         * @member {Array.<server.IFoodData>} foods
         * @memberof server.FoodCollection
         * @instance
         */
        FoodCollection.prototype.foods = $util.emptyArray;

        /**
         * Creates a new FoodCollection instance using the specified properties.
         * @function create
         * @memberof server.FoodCollection
         * @static
         * @param {server.IFoodCollection=} [properties] Properties to set
         * @returns {server.FoodCollection} FoodCollection instance
         */
        FoodCollection.create = function create(properties) {
            return new FoodCollection(properties);
        };

        /**
         * Encodes the specified FoodCollection message. Does not implicitly {@link server.FoodCollection.verify|verify} messages.
         * @function encode
         * @memberof server.FoodCollection
         * @static
         * @param {server.IFoodCollection} message FoodCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodCollection.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.foods != null && message.foods.length)
                for (let i = 0; i < message.foods.length; ++i)
                    $root.server.FoodData.encode(message.foods[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified FoodCollection message, length delimited. Does not implicitly {@link server.FoodCollection.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.FoodCollection
         * @static
         * @param {server.IFoodCollection} message FoodCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodCollection.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FoodCollection message from the specified reader or buffer.
         * @function decode
         * @memberof server.FoodCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.FoodCollection} FoodCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodCollection.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.FoodCollection();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.foods && message.foods.length))
                            message.foods = [];
                        message.foods.push($root.server.FoodData.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FoodCollection message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.FoodCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.FoodCollection} FoodCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodCollection.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FoodCollection message.
         * @function verify
         * @memberof server.FoodCollection
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FoodCollection.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.foods != null && message.hasOwnProperty("foods")) {
                if (!Array.isArray(message.foods))
                    return "foods: array expected";
                for (let i = 0; i < message.foods.length; ++i) {
                    let error = $root.server.FoodData.verify(message.foods[i]);
                    if (error)
                        return "foods." + error;
                }
            }
            return null;
        };

        /**
         * Creates a FoodCollection message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.FoodCollection
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.FoodCollection} FoodCollection
         */
        FoodCollection.fromObject = function fromObject(object) {
            if (object instanceof $root.server.FoodCollection)
                return object;
            let message = new $root.server.FoodCollection();
            if (object.foods) {
                if (!Array.isArray(object.foods))
                    throw TypeError(".server.FoodCollection.foods: array expected");
                message.foods = [];
                for (let i = 0; i < object.foods.length; ++i) {
                    if (typeof object.foods[i] !== "object")
                        throw TypeError(".server.FoodCollection.foods: object expected");
                    message.foods[i] = $root.server.FoodData.fromObject(object.foods[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a FoodCollection message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.FoodCollection
         * @static
         * @param {server.FoodCollection} message FoodCollection
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FoodCollection.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.foods = [];
            if (message.foods && message.foods.length) {
                object.foods = [];
                for (let j = 0; j < message.foods.length; ++j)
                    object.foods[j] = $root.server.FoodData.toObject(message.foods[j], options);
            }
            return object;
        };

        /**
         * Converts this FoodCollection to JSON.
         * @function toJSON
         * @memberof server.FoodCollection
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FoodCollection.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FoodCollection
         * @function getTypeUrl
         * @memberof server.FoodCollection
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FoodCollection.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.FoodCollection";
        };

        return FoodCollection;
    })();

    server.FoodMutationCollection = (function() {

        /**
         * Properties of a FoodMutationCollection.
         * @memberof server
         * @interface IFoodMutationCollection
         * @property {Array.<server.IFoodData>|null} [addedFoods] FoodMutationCollection addedFoods
         * @property {Array.<number>|null} [removedFoodIds] FoodMutationCollection removedFoodIds
         */

        /**
         * Constructs a new FoodMutationCollection.
         * @memberof server
         * @classdesc Represents a FoodMutationCollection.
         * @implements IFoodMutationCollection
         * @constructor
         * @param {server.IFoodMutationCollection=} [properties] Properties to set
         */
        function FoodMutationCollection(properties) {
            this.addedFoods = [];
            this.removedFoodIds = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FoodMutationCollection addedFoods.
         * @member {Array.<server.IFoodData>} addedFoods
         * @memberof server.FoodMutationCollection
         * @instance
         */
        FoodMutationCollection.prototype.addedFoods = $util.emptyArray;

        /**
         * FoodMutationCollection removedFoodIds.
         * @member {Array.<number>} removedFoodIds
         * @memberof server.FoodMutationCollection
         * @instance
         */
        FoodMutationCollection.prototype.removedFoodIds = $util.emptyArray;

        /**
         * Creates a new FoodMutationCollection instance using the specified properties.
         * @function create
         * @memberof server.FoodMutationCollection
         * @static
         * @param {server.IFoodMutationCollection=} [properties] Properties to set
         * @returns {server.FoodMutationCollection} FoodMutationCollection instance
         */
        FoodMutationCollection.create = function create(properties) {
            return new FoodMutationCollection(properties);
        };

        /**
         * Encodes the specified FoodMutationCollection message. Does not implicitly {@link server.FoodMutationCollection.verify|verify} messages.
         * @function encode
         * @memberof server.FoodMutationCollection
         * @static
         * @param {server.IFoodMutationCollection} message FoodMutationCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodMutationCollection.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.addedFoods != null && message.addedFoods.length)
                for (let i = 0; i < message.addedFoods.length; ++i)
                    $root.server.FoodData.encode(message.addedFoods[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.removedFoodIds != null && message.removedFoodIds.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (let i = 0; i < message.removedFoodIds.length; ++i)
                    writer.uint32(message.removedFoodIds[i]);
                writer.ldelim();
            }
            return writer;
        };

        /**
         * Encodes the specified FoodMutationCollection message, length delimited. Does not implicitly {@link server.FoodMutationCollection.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.FoodMutationCollection
         * @static
         * @param {server.IFoodMutationCollection} message FoodMutationCollection message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodMutationCollection.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FoodMutationCollection message from the specified reader or buffer.
         * @function decode
         * @memberof server.FoodMutationCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.FoodMutationCollection} FoodMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodMutationCollection.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.FoodMutationCollection();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.addedFoods && message.addedFoods.length))
                            message.addedFoods = [];
                        message.addedFoods.push($root.server.FoodData.decode(reader, reader.uint32()));
                        break;
                    }
                case 2: {
                        if (!(message.removedFoodIds && message.removedFoodIds.length))
                            message.removedFoodIds = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.removedFoodIds.push(reader.uint32());
                        } else
                            message.removedFoodIds.push(reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FoodMutationCollection message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.FoodMutationCollection
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.FoodMutationCollection} FoodMutationCollection
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodMutationCollection.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FoodMutationCollection message.
         * @function verify
         * @memberof server.FoodMutationCollection
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FoodMutationCollection.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.addedFoods != null && message.hasOwnProperty("addedFoods")) {
                if (!Array.isArray(message.addedFoods))
                    return "addedFoods: array expected";
                for (let i = 0; i < message.addedFoods.length; ++i) {
                    let error = $root.server.FoodData.verify(message.addedFoods[i]);
                    if (error)
                        return "addedFoods." + error;
                }
            }
            if (message.removedFoodIds != null && message.hasOwnProperty("removedFoodIds")) {
                if (!Array.isArray(message.removedFoodIds))
                    return "removedFoodIds: array expected";
                for (let i = 0; i < message.removedFoodIds.length; ++i)
                    if (!$util.isInteger(message.removedFoodIds[i]))
                        return "removedFoodIds: integer[] expected";
            }
            return null;
        };

        /**
         * Creates a FoodMutationCollection message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.FoodMutationCollection
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.FoodMutationCollection} FoodMutationCollection
         */
        FoodMutationCollection.fromObject = function fromObject(object) {
            if (object instanceof $root.server.FoodMutationCollection)
                return object;
            let message = new $root.server.FoodMutationCollection();
            if (object.addedFoods) {
                if (!Array.isArray(object.addedFoods))
                    throw TypeError(".server.FoodMutationCollection.addedFoods: array expected");
                message.addedFoods = [];
                for (let i = 0; i < object.addedFoods.length; ++i) {
                    if (typeof object.addedFoods[i] !== "object")
                        throw TypeError(".server.FoodMutationCollection.addedFoods: object expected");
                    message.addedFoods[i] = $root.server.FoodData.fromObject(object.addedFoods[i]);
                }
            }
            if (object.removedFoodIds) {
                if (!Array.isArray(object.removedFoodIds))
                    throw TypeError(".server.FoodMutationCollection.removedFoodIds: array expected");
                message.removedFoodIds = [];
                for (let i = 0; i < object.removedFoodIds.length; ++i)
                    message.removedFoodIds[i] = object.removedFoodIds[i] >>> 0;
            }
            return message;
        };

        /**
         * Creates a plain object from a FoodMutationCollection message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.FoodMutationCollection
         * @static
         * @param {server.FoodMutationCollection} message FoodMutationCollection
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FoodMutationCollection.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.addedFoods = [];
                object.removedFoodIds = [];
            }
            if (message.addedFoods && message.addedFoods.length) {
                object.addedFoods = [];
                for (let j = 0; j < message.addedFoods.length; ++j)
                    object.addedFoods[j] = $root.server.FoodData.toObject(message.addedFoods[j], options);
            }
            if (message.removedFoodIds && message.removedFoodIds.length) {
                object.removedFoodIds = [];
                for (let j = 0; j < message.removedFoodIds.length; ++j)
                    object.removedFoodIds[j] = message.removedFoodIds[j];
            }
            return object;
        };

        /**
         * Converts this FoodMutationCollection to JSON.
         * @function toJSON
         * @memberof server.FoodMutationCollection
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FoodMutationCollection.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FoodMutationCollection
         * @function getTypeUrl
         * @memberof server.FoodMutationCollection
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FoodMutationCollection.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.FoodMutationCollection";
        };

        return FoodMutationCollection;
    })();

    server.DeathNotification = (function() {

        /**
         * Properties of a DeathNotification.
         * @memberof server
         * @interface IDeathNotification
         * @property {number|null} [score] DeathNotification score
         * @property {number|null} [killedByEntityId] DeathNotification killedByEntityId
         */

        /**
         * Constructs a new DeathNotification.
         * @memberof server
         * @classdesc Represents a DeathNotification.
         * @implements IDeathNotification
         * @constructor
         * @param {server.IDeathNotification=} [properties] Properties to set
         */
        function DeathNotification(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * DeathNotification score.
         * @member {number} score
         * @memberof server.DeathNotification
         * @instance
         */
        DeathNotification.prototype.score = 0;

        /**
         * DeathNotification killedByEntityId.
         * @member {number} killedByEntityId
         * @memberof server.DeathNotification
         * @instance
         */
        DeathNotification.prototype.killedByEntityId = 0;

        /**
         * Creates a new DeathNotification instance using the specified properties.
         * @function create
         * @memberof server.DeathNotification
         * @static
         * @param {server.IDeathNotification=} [properties] Properties to set
         * @returns {server.DeathNotification} DeathNotification instance
         */
        DeathNotification.create = function create(properties) {
            return new DeathNotification(properties);
        };

        /**
         * Encodes the specified DeathNotification message. Does not implicitly {@link server.DeathNotification.verify|verify} messages.
         * @function encode
         * @memberof server.DeathNotification
         * @static
         * @param {server.IDeathNotification} message DeathNotification message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        DeathNotification.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.score != null && Object.hasOwnProperty.call(message, "score"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.score);
            if (message.killedByEntityId != null && Object.hasOwnProperty.call(message, "killedByEntityId"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.killedByEntityId);
            return writer;
        };

        /**
         * Encodes the specified DeathNotification message, length delimited. Does not implicitly {@link server.DeathNotification.verify|verify} messages.
         * @function encodeDelimited
         * @memberof server.DeathNotification
         * @static
         * @param {server.IDeathNotification} message DeathNotification message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        DeathNotification.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a DeathNotification message from the specified reader or buffer.
         * @function decode
         * @memberof server.DeathNotification
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {server.DeathNotification} DeathNotification
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        DeathNotification.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.server.DeathNotification();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.score = reader.uint32();
                        break;
                    }
                case 2: {
                        message.killedByEntityId = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a DeathNotification message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof server.DeathNotification
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {server.DeathNotification} DeathNotification
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        DeathNotification.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a DeathNotification message.
         * @function verify
         * @memberof server.DeathNotification
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        DeathNotification.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.score != null && message.hasOwnProperty("score"))
                if (!$util.isInteger(message.score))
                    return "score: integer expected";
            if (message.killedByEntityId != null && message.hasOwnProperty("killedByEntityId"))
                if (!$util.isInteger(message.killedByEntityId))
                    return "killedByEntityId: integer expected";
            return null;
        };

        /**
         * Creates a DeathNotification message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof server.DeathNotification
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {server.DeathNotification} DeathNotification
         */
        DeathNotification.fromObject = function fromObject(object) {
            if (object instanceof $root.server.DeathNotification)
                return object;
            let message = new $root.server.DeathNotification();
            if (object.score != null)
                message.score = object.score >>> 0;
            if (object.killedByEntityId != null)
                message.killedByEntityId = object.killedByEntityId >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a DeathNotification message. Also converts values to other types if specified.
         * @function toObject
         * @memberof server.DeathNotification
         * @static
         * @param {server.DeathNotification} message DeathNotification
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        DeathNotification.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.score = 0;
                object.killedByEntityId = 0;
            }
            if (message.score != null && message.hasOwnProperty("score"))
                object.score = message.score;
            if (message.killedByEntityId != null && message.hasOwnProperty("killedByEntityId"))
                object.killedByEntityId = message.killedByEntityId;
            return object;
        };

        /**
         * Converts this DeathNotification to JSON.
         * @function toJSON
         * @memberof server.DeathNotification
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        DeathNotification.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for DeathNotification
         * @function getTypeUrl
         * @memberof server.DeathNotification
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        DeathNotification.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/server.DeathNotification";
        };

        return DeathNotification;
    })();

    return server;
})();

export { $root as default };
