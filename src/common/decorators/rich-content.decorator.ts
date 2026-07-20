import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";

/**
 * Accepts the same shape as a question "scenario":
 *   - a plain string (kept for backwards compatibility with old data), OR
 *   - an object made up of any of: equation (string), text (string), tables (array)
 *
 * Used on questionContent, explanatoryNote, and answer option content/explanation
 * so they can hold a table, a block of text, or a plain string, exactly like scenarios do.
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

          if (typeof value === "object" && !Array.isArray(value)) {
            const allowedKeys = ["equation", "text", "tables"];
            const keys = Object.keys(value);

            if (keys.length === 0) return false;

            const keysAreValid = keys.every((key) => allowedKeys.includes(key));

            if (!keysAreValid) return false;

            if (value.equation !== undefined && typeof value.equation !== "string") return false;
            if (value.text !== undefined && typeof value.text !== "string") return false;
            if (value.tables !== undefined && !Array.isArray(value.tables)) return false;

            return true;
          }

          return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a string, or an object containing any of: equation (string), text (string), tables (array)`;
        }
      }
    });
  };
}
