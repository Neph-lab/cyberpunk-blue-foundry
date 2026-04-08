import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueItemBase extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.HTMLField({ initial: "" }),
      manufacturer: new fields.StringField({ required: true, blank: true }),
    };
  }
}
