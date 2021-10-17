import * as models from '../models';
import * as utils from '../utils';
import * as io from '../io';
import { connect, IClientOptions } from 'mqtt';


interface MQTTMessage{
  topic: string;
  message: string;
}

export class MQTTClientAction implements models.HttpRegionAction {
  id = models.ActionType.websocketClient;


  async process(context: models.ProcessorContext): Promise<boolean> {
    const { request } = context;
    if (this.isMQTTRequest(request)) {
      return await utils.triggerRequestResponseHooks(async () => {
        if (request.url) {
          return await this.requestMQTT(request, context);
        }
        return false;
      }, context);
    }
    return false;
  }

  private async requestMQTT(
    request: models.MQTTRequest,
    context: models.ProcessorContext
  ): Promise<models.HttpResponse> {
    const { httpRegion } = context;


    return await new Promise<models.HttpResponse>((resolve, reject) => {
      if (!request.url) {
        reject(new Error('request url undefined'));
        return;
      }
      const options: IClientOptions = {
      };


      if (httpRegion.metaData.noRejectUnauthorized) {
        options.rejectUnauthorized = false;
      }
      // TODO headers

      const responseTemplate: Partial<models.HttpResponse> = {
        request
      };
      const mergedData: Array<MQTTMessage | Error> = [];
      const loadingPromises: Array<Promise<unknown>> = [];

      let disposeCancellation: models.Dispose | undefined;
      if (context.progress) {
        disposeCancellation = context.progress?.register?.(() => {
          client.end(true, undefined, err => err && io.log.error('error on close', err));
        });
      }

      const client = connect(request.url, options);
      client.on('connect', packet => {
        io.log.info('MQTT connect', packet);
        responseTemplate.protocol = packet.protocolId || 'MQTT';
        responseTemplate.headers = packet.properties;
        if (packet.protocolVersion) {
          responseTemplate.httpVersion = `${packet.protocolVersion}`;
        }
      });
      client.on('reconnect', () => io.log.info('MQTT reconnect'));
      client.on('message', (topic, message, packet) => {
        io.log.info('MQTT message', message, packet);
        mergedData.push({
          topic,
          message: message.toString('utf-8')
        });
        if (!context.httpRegion.metaData.noStreamingLog) {
          loadingPromises.push(utils.logResponse(this.toHttpResponse(message, {
            ...packet,
            topic,
          }, responseTemplate), context));
        }
      });
      client.on('packetsend', packet => io.log.info('MQTT packetsend', packet));
      client.on('packetreceive', packet => io.log.info('MQTT packetreceive', packet));
      client.on('disconnect', packet => io.log.info('MQTT disconnect', packet));
      client.on('close', () => io.log.info('MQTT close'));
      client.on('offline', () => io.log.info('MQTT offline'));
      client.on('error', err => {
        io.log.info('MQTT error', err);
        mergedData.push(err);
      });
      client.on('end', async () => {
        io.log.info('MQTT end');
        if (disposeCancellation) {
          disposeCancellation();
        }
        await Promise.all(loadingPromises);
        const response = this.toMergedHttpResponse(mergedData, responseTemplate);
        resolve(response);
      });
      const topics = utils.getHeaderArray(request.headers, 'topic');
      if (topics) {
        for (const topic of topics) {
          client.subscribe(topic);
        }

        if (utils.isString(request.body)) {
          for (const topic of topics) {
            client.publish(topic, request.body, {}, err => err && io.log.error('publish error', err));
          }
          client.subscribe(request.body, err => io.log.error(err));
        }
      }
      context.variables.mqttClient = client;
      context.httpRegion.hooks.onStreaming.trigger(context)
        .then(() => client.end())
        .catch(err => reject(err))
        .finally(() => {
          delete context.variables.mqttClient;
        });
    });
  }

  private toMergedHttpResponse(
    data: Array< MQTTMessage | Error>,
    responseTemplate: Partial<models.HttpResponse>
  ): models.HttpResponse {
    const response = this.toHttpResponse(data, {}, responseTemplate);

    const error = data.find(obj => this.isMQTTError(obj));
    if (error && this.isMQTTError(error)) {
      response.statusCode = error.errno || -1;
      response.statusMessage = error.code;
    }
    return response;
  }


  private toHttpResponse(
    data: Buffer | Array<MQTTMessage | Error>,
    headers: Record<string, unknown>,
    responseTemplate: Partial<models.HttpResponse>
  ): models.HttpResponse {
    const body = Buffer.isBuffer(data) ? data.toString('utf-8') : JSON.stringify(data, null, 2);
    const rawBody: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(body);
    const response: models.HttpResponse = {
      statusCode: 0,
      protocol: 'MQTT',
      contentType: {
        mimeType: 'text/plain',
        charset: 'UTF-8',
        contentType: 'text/plain; charset=utf-8'
      },
      ...responseTemplate,
      headers,
      body,
      rawBody,
    };
    if (this.isMQTTError(data)) {
      response.statusCode = data.errno || -1;
      response.statusMessage = data.code;
    }
    return response;
  }

  private isMQTTError(data: unknown): data is Error & { code: string, errno: number;} {
    return data instanceof Error;
  }
  private isMQTTRequest(request: models.Request | undefined): request is models.MQTTRequest {
    return request?.method === 'MQTT';
  }
}
