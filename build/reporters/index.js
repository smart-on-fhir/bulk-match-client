"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextReporter = exports.CLIReporter = void 0;
var cli_1 = require("./cli");
Object.defineProperty(exports, "CLIReporter", { enumerable: true, get: function () { return __importDefault(cli_1).default; } });
var text_1 = require("./text");
Object.defineProperty(exports, "TextReporter", { enumerable: true, get: function () { return __importDefault(text_1).default; } });
