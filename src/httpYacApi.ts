import { VariableReplacerType, HttpFileSendContext, HttpRegionSendContext, HttpRegionParser, HttpClient, VariableReplacer, HttpFile, HttpRegion, ProcessorContext, VariableProvider} from './models';
import * as parser from './parser';
import { provider, replacer } from './variables';
import { sendHttpFile, sendHttpRegion, isHttpRegionSendContext } from './utils';

class HttpYacApi {
  readonly httpRegionParsers: Array<HttpRegionParser>;
  readonly variableProviders: Array<VariableProvider>;
  readonly variableReplacers: Array<VariableReplacer>;

  readonly additionalRequire: Record<string, any> = {};

  constructor() {
    this.httpRegionParsers = [
      new parser.CommentHttpRegionParser(),
      new parser.MetaHttpRegionParser(),
      new parser.VariableHttpRegionParser(),
      new parser.JsHttpRegionParser(),
      new parser.IntellijHttpRegionParser(),
      new parser.GqlHttpRegionParser(),
      new parser.RequestHttpRegionParser(),
      new parser.RequestBodyHttpRegionParser(),
    ];

    this.variableProviders = [
      new provider.HttpFileImportsVariableProvider(),
      new provider.HttpFileVariableProvider(),
    ];

    this.variableReplacers = [
      replacer.intellijVariableReplacer,
      replacer.jsVariableReplacer,
      replacer.openIdVariableReplacer,
      replacer.awsAuthVariableReplacer,
      replacer.basicAuthVariableReplacer,
      replacer.digestAuthVariableReplacer,
      replacer.hostVariableReplacer,
    ];
  }



  /**
   * process one httpRegion of HttpFile
   * @param httpFile httpFile
   */
  async send(context: HttpFileSendContext | HttpRegionSendContext) {
    if (isHttpRegionSendContext(context)) {
      return await sendHttpRegion(context);
    } else {
      return await sendHttpFile(context);
    }
  }


  async replaceVariables(text: string, type: VariableReplacerType | string, context: ProcessorContext): Promise<string | undefined> {
    let result: string | undefined = text;
    for (var replacer of this.variableReplacers) {
      if (result) {
        result = await replacer(result, type, context);
      }
    }
    return result;
  }
}

export const httpYacApi = new HttpYacApi();