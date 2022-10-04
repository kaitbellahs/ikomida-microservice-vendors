import { Domain, Utils, BackendTypes, DBModels, Types } from '@ikomida/shared-backend'

export default class Layout {
  logger
  constructor(logger: Utils.Logger) {
    this.logger = logger
  }
  async getLayout(ikomidaID: string) {
    const contractModel = await DBModels.ContractModel.findOne({
      where: {
        ikomidaID
      },
      include: [
        {
          model: DBModels.VendorSettingsModel,
          required: false
        }
      ]
    })
    if (!contractModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_INVALID_CONTRACT)
      return error.logAndReturn(this.logger)
    }
    const vendorSettingsModel = contractModel?.vendorSettings
    if (!vendorSettingsModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_EMPTY)
      return error.logAndReturn(this.logger)
    }

    return new Utils.Return(true, Types.Classes.CLayout.fromObject(vendorSettingsModel?.layout))
  }

  async setLayout(identity: Types.Classes.CUser, input: any) {
    try {
      const payload: Types.Classes.CLayout = Types.Classes.CLayout.fromObject(input)
      if (!payload.validate()) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUTS_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [BackendTypes.Roles.VENDOR, BackendTypes.Roles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_INVALID_CONTRACT)
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EMPTY)
        return error.logAndReturn(this.logger)
      }
      // const layout: Types.Classes.CLayout = Types.Classes.CLayout.fromObject({
      //   link: object?.link,
      //   background: object?.background,
      //   color: object?.color,
      //   header: {
      //     background: object?.header?.background,
      //     color: object?.header?.color,
      //     menuHamburger: object?.header?.menuHamburger,
      //   },
      //   tabs: {
      //     background: object?.tabs?.background,
      //     color: object?.tabs?.color,
      //   },
      //   button: {
      //     background: object?.button?.background,
      //     color: object?.button?.color,
      //   },
      // });
      vendorSettingsModel.layout = payload.toJSON()
      await vendorSettingsModel.save()
      return new Utils.Return(true, null)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EXCEPTION, exception)
      return error.logAndReturn(this.logger)
    }
  }
}
