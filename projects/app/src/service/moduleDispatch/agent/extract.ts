import { adaptChat2GptMessages } from '@/utils/common/adapt/message';
import { ChatContextFilter } from '@/service/common/tiktoken';
import type { ChatHistoryItemResType, ChatItemType } from '@/types/chat';
import { ChatRoleEnum, TaskResponseKeyEnum } from '@/constants/chat';
import { getAIApi } from '@fastgpt/service/core/ai/config';
import type { ContextExtractAgentItemType } from '@/types/app';
import { ContextExtractEnum } from '@/constants/flow/flowField';
import { FlowModuleTypeEnum } from '@/constants/flow';
import type { ModuleDispatchProps } from '@/types/core/chat/type';
import { Prompt_ExtractJson } from '@/global/core/prompt/agent';
import { replaceVariable } from '@/global/common/string/tools';
import { FunctionModelItemType } from '@/types/model';

type Props = ModuleDispatchProps<{
  history?: ChatItemType[];
  [ContextExtractEnum.content]: string;
  [ContextExtractEnum.extractKeys]: ContextExtractAgentItemType[];
  [ContextExtractEnum.description]: string;
}>;
type Response = {
  [ContextExtractEnum.success]?: boolean;
  [ContextExtractEnum.failed]?: boolean;
  [ContextExtractEnum.fields]: string;
  [TaskResponseKeyEnum.responseData]: ChatHistoryItemResType;
};

const agentFunName = 'agent_extract_data';

export async function dispatchContentExtract(props: Props): Promise<Response> {
  const {
    moduleName,
    user,
    inputs: { content, description, extractKeys }
  } = props;

  if (!content) {
    return Promise.reject('Input is empty');
  }

  const extractModel = global.extractModels[0];

  const { arg, tokens } = await (async () => {
    if (extractModel.functionCall) {
      return functionCall({
        ...props,
        extractModel
      });
    }
    return completions({
      ...props,
      extractModel
    });
  })();

  // remove invalid key
  for (let key in arg) {
    if (!extractKeys.find((item) => item.key === key)) {
      delete arg[key];
    }
  }

  // auth fields
  let success = !extractKeys.find((item) => !arg[item.key]);
  // auth empty value
  if (success) {
    for (const key in arg) {
      if (arg[key] === '') {
        success = false;
        break;
      }
    }
  }

  return {
    [ContextExtractEnum.success]: success ? true : undefined,
    [ContextExtractEnum.failed]: success ? undefined : true,
    [ContextExtractEnum.fields]: JSON.stringify(arg),
    ...arg,
    [TaskResponseKeyEnum.responseData]: {
      moduleType: FlowModuleTypeEnum.contentExtract,
      moduleName,
      price: user.openaiAccount?.key ? 0 : extractModel.price * tokens,
      model: extractModel.name || '',
      tokens,
      extractDescription: description,
      extractResult: arg
    }
  };
}

async function functionCall({
  extractModel,
  user,
  inputs: { history = [], content, extractKeys, description }
}: Props & { extractModel: FunctionModelItemType }) {
  const messages: ChatItemType[] = [
    ...history,
    {
      obj: ChatRoleEnum.Human,
      value: content
    }
  ];
  const filterMessages = ChatContextFilter({
    messages,
    maxTokens: extractModel.maxToken
  });
  const adaptMessages = adaptChat2GptMessages({ messages: filterMessages, reserveId: false });

  const properties: Record<
    string,
    {
      type: string;
      description: string;
    }
  > = {};
  extractKeys.forEach((item) => {
    properties[item.key] = {
      type: 'string',
      description: item.desc
    };
  });

  // function body
  const agentFunction = {
    name: agentFunName,
    description: `${description}\n如果内容不存在，返回空字符串。`,
    parameters: {
      type: 'object',
      properties,
      required: extractKeys.filter((item) => item.required).map((item) => item.key)
    }
  };

  const ai = getAIApi(user.openaiAccount, 480000);

  const response = await ai.chat.completions.create({
    model: extractModel.model,
    temperature: 0,
    messages: [...adaptMessages],
    function_call: { name: agentFunName },
    functions: [agentFunction]
  });

  const arg: Record<string, any> = (() => {
    try {
      return JSON.parse(response.choices?.[0]?.message?.function_call?.arguments || '{}');
    } catch (error) {
      return {};
    }
  })();

  const tokens = response.usage?.total_tokens || 0;
  return {
    tokens,
    arg
  };
}

async function completions({
  extractModel,
  user,
  inputs: { history = [], content, extractKeys, description }
}: Props & { extractModel: FunctionModelItemType }) {
  const messages: ChatItemType[] = [
    {
      obj: ChatRoleEnum.Human,
      value: replaceVariable(extractModel.functionPrompt || Prompt_ExtractJson, {
        description,
        json: extractKeys
          .map(
            (item) =>
              `key="${item.key}"，描述="${item.desc}"，required="${
                item.required ? 'true' : 'false'
              }"`
          )
          .join('\n'),
        text: `${history.map((item) => `${item.obj}:${item.value}`).join('\n')}
Human: ${content}`
      })
    }
  ];

  const ai = getAIApi(user.openaiAccount, 480000);

  const data = await ai.chat.completions.create({
    model: extractModel.model,
    temperature: 0.01,
    messages: adaptChat2GptMessages({ messages, reserveId: false }),
    stream: false
  });
  const answer = data.choices?.[0].message?.content || '';
  const totalTokens = data.usage?.total_tokens || 0;

  // parse response
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');

  if (start === -1 || end === -1)
    return {
      tokens: totalTokens,
      arg: {}
    };

  const jsonStr = answer
    .substring(start, end + 1)
    .replace(/(\\n|\\)/g, '')
    .replace(/  /g, '');

  try {
    return {
      tokens: totalTokens,
      arg: JSON.parse(jsonStr) as Record<string, any>
    };
  } catch (error) {
    return {
      tokens: totalTokens,
      arg: {}
    };
  }
}
