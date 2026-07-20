import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";

const ALLOWED_BLOCK_KEYS = ["equation", "text", "tables"];

function isValidBlock(block: any): boolean {
  if (typeof block !== "object" || block === null || Array.isArray(block)) return false;

  const keys = Object.keys(block);

  if (!keys.every((key) => ALLOWED_BLOCK_KEYS.includes(key))) return false;

  if (block.equation !== undefined && typeof block.equation !== "string") return false;
  if (block.text !== undefined && typeof block.text !== "string") return false;
  if (block.tables !== undefined && !Array.isArray(block.tables)) return false;

  return true;
}

/**
 * Accepts what the frontend actually sends for rich content fields
 * (questionContent, explanatoryNote, answer option content/explanation):
 *   - a plain string (legacy data), OR
 *   - { blocks: [ { equation?, text?, tables? }, ... ] }
 *
 * Also accepts a single flat { equation?, text?, tables? } object (no "blocks"
 * wrapper) so older scenario-shaped payloads keep working.
 */
export function IsRichContent(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "isRichContent",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (value === undefined || value === null) return true;

          if (typeof value === "string") return true;

          if (typeof value !== "object" || Array.isArray(value)) return false;

          if (Array.isArray(value.blocks)) {
            return value.blocks.length > 0 && value.blocks.every(isValidBlock);
          }

          return isValidBlock(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a string, or an object with a "blocks" array of { equation, text, tables } items`;
        }
      }
    });
  };
}
